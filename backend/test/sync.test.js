import { api, register, startServer, stopServer } from "./helpers.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectImageType } from "../controllers/photoControllers.js";

let app;
let http;
let anna;
let bob;

const account = (overrides = {}) => ({
  name: "Card",
  currency: "UAH",
  icon: "credit-card",
  color: "#42a5f5",
  balanceAnchor: 100000,
  balanceAnchorAt: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

const transaction = (overrides = {}) => ({
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-food",
  amount: 2550,
  currency: "UAH",
  accountAmount: 2550,
  rate: 1,
  date: "2026-11-05",
  clientCreatedAt: "2026-11-05T12:00:00.000Z",
  ...overrides,
});

const push = (user, changes, epoch = 0) => http.post("/sync/push", { epoch, changes }, user.accessToken);
const pull = (user, since = 0, extra = "") => http.get(`/sync/pull?since=${since}${extra}`, user.accessToken);

before(async () => {
  app = await startServer();
  http = api(app);
  anna = await register(app, "anna@gmail.com");
  bob = await register(app, "bob@gmail.com");
});
after(stopServer);

describe("push and pull", () => {
  it("applies a batch and returns it from the cursor", async () => {
    const initial = await pull(anna);
    // The 14 default categories
    assert.equal(initial.body.changes.length, 14);
    const cursor = initial.body.cursor;

    const res = await push(anna, [
      { collection: "accounts", id: "acc-1", op: "upsert", data: account() },
      { collection: "transactions", id: "tx-1", op: "upsert", data: transaction() },
    ]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.results.map((r) => r.status), ["applied", "applied"]);

    const changes = await pull(anna, cursor);
    assert.deepEqual(changes.body.changes.map((c) => c.id), ["acc-1", "tx-1"]);
    assert.equal(changes.body.changes[1].data.amount, 2550);
    assert.equal(changes.body.changes[1].data.userId, undefined);

    const nothing = await pull(anna, changes.body.cursor);
    assert.equal(nothing.body.changes.length, 0);
  });

  it("is idempotent when a batch is sent twice", async () => {
    const batch = [{ collection: "transactions", id: "tx-2", op: "upsert", data: transaction({ amount: 100, accountAmount: 100 }) }];
    await push(anna, batch);
    await push(anna, batch);
    const list = await http.get("/transactions", anna.accessToken);
    assert.equal(list.body.items.filter((t) => t.id === "tx-2").length, 1);
  });

  it("pages with limit and hasMore", async () => {
    const first = await pull(anna, 0, "&limit=5");
    assert.equal(first.body.changes.length, 5);
    assert.equal(first.body.hasMore, true);
    const seqs = first.body.changes.map((c) => c.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  });

  it("sends deletions as tombstones and refuses to resurrect them", async () => {
    const { body: before } = await pull(anna);
    await push(anna, [{ collection: "transactions", id: "tx-2", op: "delete" }]);

    const changes = await pull(anna, before.cursor);
    assert.deepEqual(changes.body.changes, [{ collection: "transactions", id: "tx-2", seq: changes.body.cursor, deleted: true }]);

    const stale = await push(anna, [{ collection: "transactions", id: "tx-2", op: "upsert", data: transaction() }]);
    assert.equal(stale.body.results[0].code, "sync.deleted");
  });

  it("rejects invalid records one by one without dropping the rest", async () => {
    const res = await push(anna, [
      { collection: "transactions", id: "tx-bad", op: "upsert", data: transaction({ amount: -5 }) },
      { collection: "transactions", id: "tx-3", op: "upsert", data: transaction({ amount: 25.5 }) },
      { collection: "transactions", id: "tx-4", op: "upsert", data: transaction() },
    ]);
    assert.deepEqual(res.body.results.map((r) => r.status), ["rejected", "rejected", "applied"]);
  });
});

describe("ownership", () => {
  it("never lets another user read or overwrite a record", async () => {
    const res = await push(bob, [{ collection: "accounts", id: "acc-1", op: "upsert", data: account({ name: "Hijacked" }) }]);
    assert.equal(res.body.results[0].code, "sync.forbidden");

    const del = await push(bob, [{ collection: "accounts", id: "acc-1", op: "delete" }]);
    assert.equal(del.body.results[0].code, "sync.forbidden");

    const get = await http.get("/accounts/acc-1", bob.accessToken);
    assert.equal(get.status, 404);
    const own = await http.get("/accounts/acc-1", anna.accessToken);
    assert.equal(own.body.item.name, "Card");
  });
});

describe("business rules", () => {
  it("keeps an account's currency fixed", async () => {
    await push(anna, [{ collection: "accounts", id: "acc-1", op: "upsert", data: account({ currency: "USD", name: "Renamed" }) }]);
    const { body } = await http.get("/accounts/acc-1", anna.accessToken);
    assert.equal(body.item.currency, "UAH");
    assert.equal(body.item.name, "Renamed");
  });

  it("protects the Other category", async () => {
    const { body } = await http.get("/categories", anna.accessToken);
    const other = body.items.find((c) => c.isSystemOther);
    const res = await push(anna, [{ collection: "categories", id: other.id, op: "delete" }]);
    assert.equal(res.body.results[0].code, "category.otherNotDeletable");

    const forged = await push(anna, [
      { collection: "categories", id: "cat-new", op: "upsert", data: { name: "Mine", type: "expense", icon: "star", color: "#ffffff", isSystemOther: true } },
    ]);
    assert.equal(forged.body.results[0].status, "applied");
    const created = await http.get("/categories/cat-new", anna.accessToken);
    assert.equal(created.body.item.isSystemOther, false);

    // Only the color (and order) of "Other" can change.
    const edit = await push(anna, [
      {
        collection: "categories",
        id: other.id,
        op: "upsert",
        data: { name: "Renamed", type: other.type, icon: "star", color: "#123456", plannedMonthly: 500, sortOrder: 9 },
      },
    ]);
    assert.equal(edit.body.results[0].status, "applied");
    const after = await http.get(`/categories/${other.id}`, anna.accessToken);
    assert.equal(after.body.item.color, "#123456");
    assert.equal(after.body.item.sortOrder, 9);
    assert.equal(after.body.item.name, null);
    assert.equal(after.body.item.nameKey, "category.other");
    assert.equal(after.body.item.icon, other.icon);
    assert.equal(after.body.item.plannedMonthly, null);
  });

  it("keeps tag names unique regardless of case", async () => {
    const res = await push(anna, [
      { collection: "tags", id: "tag-1", op: "upsert", data: { name: "Trip" } },
      { collection: "tags", id: "tag-2", op: "upsert", data: { name: "TRIP" } },
    ]);
    assert.deepEqual(res.body.results.map((r) => r.status), ["applied", "rejected"]);
    assert.equal(res.body.results[1].code, "tag.duplicate");
  });

  it("validates repeat rules", async () => {
    const base = {
      type: "expense", name: "Rent", startDate: "2026-12-01", time: "09:00",
      accountId: "acc-1", categoryId: "cat-food", amount: 1000000, currency: "UAH",
    };
    const res = await push(anna, [
      { collection: "recurring", id: "rec-1", op: "upsert", data: { ...base, rule: { kind: "monthly" } } },
      { collection: "recurring", id: "rec-2", op: "upsert", data: { ...base, rule: { kind: "custom", cron: "0 9 * * 1" } } },
      { collection: "recurring", id: "rec-3", op: "upsert", data: { ...base, rule: { kind: "custom" } } },
      { collection: "recurring", id: "rec-4", op: "upsert", data: { ...base, rule: { kind: "custom", cron: "every monday" } } },
    ]);
    assert.deepEqual(res.body.results.map((r) => r.status), ["applied", "applied", "rejected", "rejected"]);
  });

  it("works through the plain CRUD routes too", async () => {
    const put = await http.put("/reminders/rem-1", { title: "Pay taxes", rule: { kind: "yearly" }, startDate: "2027-03-01", time: "10:00" }, anna.accessToken);
    assert.equal(put.status, 200);
    assert.equal(put.body.item.active, true);

    const del = await http.del("/reminders/rem-1", anna.accessToken);
    assert.equal(del.status, 204);
    const gone = await http.get("/reminders/rem-1", anna.accessToken);
    assert.equal(gone.status, 404);

    const unknown = await http.get("/nothing", anna.accessToken);
    assert.equal(unknown.status, 404);
  });
});

describe("delete all data", () => {
  it("wipes the data, resets categories and tells stale devices to reset", async () => {
    const res = await http.del("/data/all", anna.accessToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.dataEpoch, 1);

    const stalePull = await pull(anna, 0, "&epoch=0");
    assert.deepEqual(stalePull.body, { reset: true, epoch: 1 });

    const stalePush = await push(anna, [{ collection: "tags", id: "tag-9", op: "upsert", data: { name: "Old" } }], 0);
    assert.equal(stalePush.body.code, "sync.reset");

    const fresh = await pull(anna, 0, "&epoch=1");
    assert.equal(fresh.body.changes.length, 14);
    assert.ok(fresh.body.changes.every((c) => c.collection === "categories"));

    const bobData = await http.get("/accounts", bob.accessToken);
    assert.equal(bobData.status, 200);
  });
});

describe("photo type detection", () => {
  it("reads the type from the file content", () => {
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpg");
    assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
    assert.equal(detectImageType(Buffer.from("\0\0\0\x18ftypheic\0\0\0\0", "latin1")), "heic");
    assert.equal(detectImageType(Buffer.from("<svg onload=alert(1)>")), null);
  });
});

describe("dictionaries", () => {
  it("serves languages and the bundled English dictionary", async () => {
    const langs = await http.get("/i18n");
    assert.equal(langs.body.languages.length, 22);
    const en = await http.get("/i18n/en");
    assert.equal(en.body.strings["category.food"], "Food");
    const unknown = await http.get("/i18n/xx");
    assert.equal(unknown.status, 404);
  });
});
