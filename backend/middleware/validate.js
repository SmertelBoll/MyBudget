import { AppError } from "../utils/AppError.js";

// Parses req[source] with a zod schema. The parsed value (trimmed, defaulted, unknown keys stripped) goes to
// req.valid: in Express 5 req.query is read-only, so the original is never replaced.
export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      throw new AppError(
        400,
        "common.validation",
        result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      );
    }
    req.valid = result.data;
    next();
  };

const hasOperatorKey = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, nested]) => key.startsWith("$") || key.includes(".") || hasOperatorKey(nested, depth + 1)
  );
};

// NoSQL-injection guard: no client payload ever needs a "$" or dotted key.
export const rejectOperators = (req, res, next) => {
  if (hasOperatorKey(req.body)) {
    throw new AppError(400, "common.validation");
  }
  next();
};
