import { api, isNetworkError } from "@/api/client";
import { getDeviceInfo } from "@/auth/device";
import { readJson, writeJson } from "@/storage/json";

// Contact the support (spec screen 3): subject, message, an optional screenshot; the app version and device model
// are added. Offline the message waits on the device and goes with the next successful sync.

const QUEUE_KEY = "support.queue";

type SupportMessage = { subject: string; message: string; screenshotPhotoId?: string; appVersion: string; device: string };

const queued = async () => (await readJson<SupportMessage[]>(QUEUE_KEY)) ?? [];

// "sent", or "queued" when there's no connection. Other errors (rate limit, validation) are thrown.
export const sendSupportMessage = async (input: { subject: string; message: string; screenshotPhotoId?: string }) => {
  const device = await getDeviceInfo();
  const message: SupportMessage = { ...input, appVersion: device.appVersion, device: `${device.deviceName} (${device.platform})` };
  try {
    await api.post("/support", message);
    return "sent" as const;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await writeJson(QUEUE_KEY, [...(await queued()), message]);
    return "queued" as const;
  }
};

// Called after a sync got through (the screenshot, if any, has just been uploaded).
export const flushSupportQueue = async () => {
  const list = await queued();
  if (!list.length) return;
  const left: SupportMessage[] = [];
  for (const message of list) {
    try {
      await api.post("/support", message);
    } catch (error) {
      // Offline again: keep it. Refused by the server: drop it, retrying won't help.
      if (isNetworkError(error)) left.push(message);
    }
  }
  await writeJson(QUEUE_KEY, left);
};
