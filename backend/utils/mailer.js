import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter;

export const isMailConfigured = () => Boolean(config.smtp.host && config.supportEmail);

export const sendMail = (options) => {
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter.sendMail({ from: config.smtp.from || config.smtp.user, ...options });
};
