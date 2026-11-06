import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { storage } from "@/storage/storage";
import type { DeviceInfo } from "@/api/types";

const DEVICE_ID_KEY = "device.id";

// What the server shows in the sessions list (spec 3.3). The id is random and stays on this install.
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  let deviceId = await storage.get(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await storage.set(DEVICE_ID_KEY, deviceId);
  }

  const platform = Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : "other";
  return {
    deviceId,
    deviceName: (Device.modelName || Device.deviceName || platform).slice(0, 100),
    platform,
    appVersion: (Application.nativeApplicationVersion || "dev").slice(0, 20),
  };
};
