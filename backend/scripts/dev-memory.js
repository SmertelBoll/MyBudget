// Runs the API against a throwaway in-memory MongoDB: no Atlas needed, all data is gone when it stops.
//   npm run dev:memory
// Other settings (JWT secrets, Cloudinary...) still come from .env; MONGODB_URI there is ignored.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri("mybudget");
process.env.JWT_ACCESS_SECRET ||= "dev-access-secret";
process.env.JWT_REFRESH_SECRET ||= "dev-refresh-secret";
// The Expo web dev server, so the app can be tried in a browser.
process.env.CORS_ORIGINS ||= "http://localhost:8081";

const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("in-memory MongoDB:", process.env.MONGODB_URI);
await import("../index.js");
