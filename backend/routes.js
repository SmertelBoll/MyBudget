import express from "express";
import { checkAuth } from "./middleware/checkAuth.js";
import { validate } from "./middleware/validate.js";
import { authLimiter, refreshLimiter, supportLimiter } from "./middleware/rateLimits.js";
import { googleSchema, loginSchema, refreshSchema, registerSchema } from "./validations/auth.js";
import { renameSessionSchema, supportSchema, updateMeSchema } from "./validations/me.js";
import { pullSchema, pushSchema } from "./validations/entities.js";
import { googleLogin, login, logout, refresh, register } from "./controllers/authControllers.js";
import { getSessions, renameSession, revokeOtherSessions, revokeSession } from "./controllers/sessionControllers.js";
import { deleteAllData, deleteMe, getMe, restoreData, updateMe } from "./controllers/meControllers.js";
import { deleteEntity, getEntity, listEntities, pull, push, putEntity } from "./controllers/syncControllers.js";
import { getPhoto, photoUpload, uploadPhoto } from "./controllers/photoControllers.js";
import { getCurrencies, getLanguages, getRates, getTranslations } from "./controllers/dictionaryControllers.js";
import { createSupportMessage } from "./controllers/supportControllers.js";

// Everything is mounted under /api/v1. All routes except auth, i18n and rates need an access token.
const router = express.Router();

router.post("/auth/register", authLimiter, validate(registerSchema), register);
router.post("/auth/login", authLimiter, validate(loginSchema), login);
router.post("/auth/google", authLimiter, validate(googleSchema), googleLogin);
router.post("/auth/refresh", refreshLimiter, validate(refreshSchema), refresh);
router.post("/auth/logout", refreshLimiter, validate(refreshSchema), logout);

router.get("/i18n", getLanguages);
router.get("/i18n/:lang", getTranslations);
router.get("/rates", getRates);
router.get("/currencies", getCurrencies);

router.use(checkAuth);

router.get("/sessions", getSessions);
router.delete("/sessions/others", revokeOtherSessions);
router.delete("/sessions/:id", revokeSession);
router.patch("/sessions/:id", validate(renameSessionSchema), renameSession);

router.get("/me", getMe);
router.patch("/me", validate(updateMeSchema), updateMe);
router.delete("/me", deleteMe);

router.post("/sync/push", validate(pushSchema), push);
router.get("/sync/pull", validate(pullSchema, "query"), pull);

router.post("/photos", photoUpload, uploadPhoto);
router.get("/photos/:id", getPhoto);

router.delete("/data/all", deleteAllData);
router.post("/data/restore", restoreData);

router.post("/support", supportLimiter, validate(supportSchema), createSupportMessage);

// accounts, categories, tags, transactions, transfers, recurring, reminders. Last: ":collection" matches anything.
router.get("/:collection", listEntities);
router.get("/:collection/:id", getEntity);
router.put("/:collection/:id", putEntity);
router.delete("/:collection/:id", deleteEntity);

export default router;
