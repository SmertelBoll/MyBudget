// One-off: balances used to be counted from an anchor (balanceAnchor + entries created after balanceAnchorAt). Now
// a balance is the sum of all the account's entries and transfers, and a balance typed by hand is a hidden
// correction entry. For every account this adds the correction that keeps its balance exactly as it was, and resets
// the anchor to 0. Safe to run again: an account already at 0 with nothing before its anchor gets no correction.
//   node scripts/migrate-balance-corrections.js            -> shows what would change
//   node scripts/migrate-balance-corrections.js --apply    -> writes it
import crypto from "crypto";
import mongoose from "mongoose";
import { assertConfig, config } from "../config.js";
import AccountModel from "../models/account.js";
import TransactionModel from "../models/transaction.js";
import TransferModel from "../models/transfer.js";
import { reserveSeq } from "../utils/syncEngine.js";

const apply = process.argv.includes("--apply");
assertConfig();
await mongoose.connect(config.mongoUri);

const live = { deletedAt: null };
const accounts = await AccountModel.find(live).lean();
const byUser = new Map();
for (const account of accounts) {
  const list = byUser.get(String(account.userId)) ?? [];
  list.push(account);
  byUser.set(String(account.userId), list);
}

let added = 0;
for (const [userId, list] of byUser) {
  const ids = list.map((account) => account._id);
  const transactions = await TransactionModel.find({ ...live, userId, accountId: { $in: ids } }).lean();
  const transfers = await TransferModel.find({ ...live, userId, $or: [{ fromAccountId: { $in: ids } }, { toAccountId: { $in: ids } }] }).lean();

  const changes = [];
  for (const account of list) {
    const anchorAt = new Date(account.balanceAnchorAt).getTime();
    let before = account.balanceAnchor ?? 0; // the old rule
    let after = 0; // the new rule
    const count = (createdAt, delta) => {
      after += delta;
      if (new Date(createdAt).getTime() > anchorAt) before += delta;
    };
    for (const tx of transactions) {
      if (tx.accountId === account._id) count(tx.clientCreatedAt, tx.type === "income" ? tx.accountAmount : -tx.accountAmount);
    }
    for (const transfer of transfers) {
      if (transfer.fromAccountId === account._id) count(transfer.clientCreatedAt, -transfer.amountFrom);
      if (transfer.toAccountId === account._id) count(transfer.clientCreatedAt, transfer.amountTo);
    }
    const delta = before - after;
    if (delta || account.balanceAnchor) changes.push({ account, delta });
  }
  if (!changes.length) continue;

  for (const { account, delta } of changes) {
    console.log(`${userId} ${account.name} (${account.currency}): correction ${delta / 100}, anchor ${(account.balanceAnchor ?? 0) / 100} -> 0`);
  }
  if (!apply) continue;

  // Two change numbers per account (the correction and the account), so other devices pull both.
  let seq = await reserveSeq(userId, changes.length * 2);
  for (const { account, delta } of changes) {
    if (delta) {
      const at = new Date(account.balanceAnchorAt);
      await TransactionModel.create({
        _id: crypto.randomUUID(),
        userId: account.userId,
        seq: ++seq,
        type: delta > 0 ? "income" : "expense",
        accountId: account._id,
        categoryId: null,
        isCorrection: true,
        tagIds: [],
        amount: Math.abs(delta),
        currency: account.currency,
        accountAmount: Math.abs(delta),
        rate: 1,
        date: at.toISOString().slice(0, 10),
        clientCreatedAt: at,
      });
      added += 1;
    } else seq += 1;
    await AccountModel.updateOne({ _id: account._id }, { $set: { balanceAnchor: 0, seq: ++seq } });
  }
}

console.log(apply ? `Done: ${added} corrections added.` : "Dry run. Add --apply to write.");
await mongoose.disconnect();
