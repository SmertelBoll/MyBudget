import mongoose from "mongoose";
import { assertConfig, config } from "./config.js";
import { app } from "./app.js";
import { startRatesJob } from "./jobs/rates.js";
import { startCleanupJob } from "./jobs/cleanup.js";

assertConfig();

await mongoose.connect(config.mongoUri);
console.log("DB ok");

startRatesJob();
startCleanupJob();

app.listen(config.port, (err) => {
  if (err) {
    console.log("server error", err);
    process.exit(1);
  }
  console.log(`server ok on port ${config.port}`);
});
