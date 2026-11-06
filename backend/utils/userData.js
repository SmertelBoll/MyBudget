import UserModel from "../models/user.js";
import SessionModel from "../models/session.js";
import PhotoModel from "../models/photo.js";
import { SecurityEventModel, SupportMessageModel } from "../models/misc.js";
import { SYNCED_MODELS } from "./syncEngine.js";
import { createDefaultCategories } from "./defaultData.js";
import { destroyUserImages } from "./cloudinary.js";
import { withUserLock } from "./userLock.js";

// "Delete all data" (keepAccount) and "delete account" (spec 13.4, screen 12). Records are removed for real, not
// soft-deleted; other devices learn about it through dataEpoch and wipe their local copy.
export const deleteUserData = (userId, { keepAccount }) =>
  withUserLock(userId, async () => {
    await destroyUserImages(userId);
    await PhotoModel.deleteMany({ userId });
    await Promise.all(Object.values(SYNCED_MODELS).map((Model) => Model.deleteMany({ userId })));

    if (keepAccount) {
      await UserModel.updateOne(
        { _id: userId },
        { $inc: { dataEpoch: 1 }, $set: { "settings.homeAccount": "total", "settings.defaultAccountId": null } }
      );
      await createDefaultCategories(userId);
      return;
    }

    await Promise.all([
      SessionModel.deleteMany({ userId }),
      SecurityEventModel.deleteMany({ userId }),
      SupportMessageModel.deleteMany({ userId }),
      UserModel.deleteOne({ _id: userId }),
    ]);
  });
