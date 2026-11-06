import { AppError } from "../utils/AppError.js";
import { SYNCED_MODELS, applyChanges, applySingleChange, pullChanges, toEntity } from "../utils/syncEngine.js";

// Spec 4.1: the client sends its outbox in batches...
export const push = async (req, res) => {
  const { epoch, changes } = req.valid;
  const results = await applyChanges(req.userId, epoch, changes);
  res.json({ results });
};

// ...and pages through everything changed since its cursor.
export const pull = async (req, res) => {
  res.json(await pullChanges(req.userId, req.valid));
};

// Plain CRUD over the same collections (spec 7.1). Writes go through the sync engine, so they get the same checks
// and show up in /sync/pull on other devices.
const modelFor = (req) => {
  const Model = SYNCED_MODELS[req.params.collection];
  if (!Model) throw new AppError(404, "common.notFound");
  if (req.params.id && req.params.id.length > 64) throw new AppError(400, "common.validation");
  return Model;
};

export const listEntities = async (req, res) => {
  const docs = await modelFor(req).find({ userId: req.userId, deletedAt: null }).sort({ createdAt: 1 }).lean();
  res.json({ items: docs.map(toEntity) });
};

export const getEntity = async (req, res) => {
  const doc = await modelFor(req).findOne({ _id: req.params.id, userId: req.userId, deletedAt: null }).lean();
  if (!doc) throw new AppError(404, "common.notFound");
  res.json({ item: toEntity(doc) });
};

export const putEntity = async (req, res) => {
  const Model = modelFor(req);
  await applySingleChange(req.userId, { collection: req.params.collection, id: req.params.id, op: "upsert", data: req.body });
  const doc = await Model.findById(req.params.id).lean();
  res.json({ item: toEntity(doc) });
};

export const deleteEntity = async (req, res) => {
  modelFor(req);
  await applySingleChange(req.userId, { collection: req.params.collection, id: req.params.id, op: "delete" });
  res.status(204).end();
};
