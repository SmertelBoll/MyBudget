// Import this first in every test file: it sets the env before config.js is loaded.
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.BCRYPT_ROUNDS = "4";
process.env.ALLOWED_EMAIL_DOMAINS = "gmail.com";

let mongod;

export const startServer = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const { app } = await import("../app.js");
  return app;
};

export const stopServer = async () => {
  await mongoose.disconnect();
  await mongod?.stop();
};

export const PASSWORD = "correct-horse-battery";

export const device = (name = "Pixel 8") => ({
  deviceId: name,
  deviceName: name,
  platform: "android",
  appVersion: "0.1.0",
});

export const api = (app) => ({
  post: (path, body, token) => withToken(request(app).post(`/api/v1${path}`), token).send(body),
  put: (path, body, token) => withToken(request(app).put(`/api/v1${path}`), token).send(body),
  patch: (path, body, token) => withToken(request(app).patch(`/api/v1${path}`), token).send(body),
  get: (path, token) => withToken(request(app).get(`/api/v1${path}`), token),
  del: (path, token) => withToken(request(app).delete(`/api/v1${path}`), token),
});

const withToken = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);

export const register = async (app, email, deviceName) => {
  const res = await api(app).post("/auth/register", { email, password: PASSWORD, device: device(deviceName) });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};

export const login = async (app, email, deviceName) => {
  const res = await api(app).post("/auth/login", { email, password: PASSWORD, device: device(deviceName) });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};
