import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { config } from "./config.js";
import router from "./routes.js";
import { rejectOperators } from "./middleware/validate.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export const app = express();

// Render (and most hosts) sit behind one proxy: req.ip must be the client's address, not the proxy's.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
// The mobile app sends no Origin header, so CORS only matters for browsers; allow the listed origins only.
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
app.use(compression());

// A sync batch can be large; every other body is small. The first parser to run wins.
app.use("/api/v1/sync", express.json({ limit: "2mb" }));
// A backup holds every record of the account.
app.use("/api/v1/data/restore", express.json({ limit: "20mb" }));
app.use(express.json({ limit: "100kb" }));
app.use(rejectOperators);

// Cheap endpoint the app calls on launch to wake a sleeping free instance.
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1", router);

app.use(notFound);
app.use(errorHandler);
