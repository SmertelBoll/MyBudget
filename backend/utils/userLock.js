const tails = new Map();

// Runs fn after every earlier call for the same user has finished. Sync writes take sequence numbers in order, so
// they must also land in that order, or /sync/pull could move its cursor past a write that hasn't happened yet.
// In-memory: correct for a single server instance; several instances would need a lock in the database.
export const withUserLock = (userId, fn) => {
  const key = String(userId);
  const run = (tails.get(key) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
};
