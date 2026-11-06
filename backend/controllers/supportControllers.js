import { config } from "../config.js";
import UserModel from "../models/user.js";
import { SupportMessageModel } from "../models/misc.js";
import { isMailConfigured, sendMail } from "../utils/mailer.js";

const forwardByEmail = async (message) => {
  const user = await UserModel.findById(message.userId).select("email").lean();
  await sendMail({
    to: config.supportEmail,
    replyTo: user?.email,
    subject: `[MyBudget] ${message.subject}`,
    text: [
      message.message,
      "",
      `User: ${user?.email || message.userId}`,
      `App version: ${message.appVersion || "-"}`,
      `Device: ${message.device || "-"}`,
      message.screenshotPhotoId ? `Screenshot photo id: ${message.screenshotPhotoId}` : "",
    ].join("\n"),
  });
  await SupportMessageModel.updateOne({ _id: message._id }, { $set: { emailedAt: new Date() } });
};

// Saved first, so nothing is lost if mail is down or not configured; forwarding happens after the response.
export const createSupportMessage = async (req, res) => {
  const message = await SupportMessageModel.create({ userId: req.userId, ...req.valid });
  if (isMailConfigured()) {
    forwardByEmail(message).catch((error) => console.log("support email error:", error));
  }
  res.status(201).json({ id: message._id });
};
