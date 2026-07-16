import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerMobilePushToken } from "../api/mobile";
import { MOBILE_PUSH } from "../config";

export async function registerForMobilePush(businessId: number) {
  if (!Device.isDevice) {
    return { ok: false, reason: "physical_device_required" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  let status = currentPermission.status;
  if (status !== "granted") {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    status = requestedPermission.status;
  }
  if (status !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const tokenResponse = MOBILE_PUSH.easProjectId
    ? await Notifications.getExpoPushTokenAsync({ projectId: MOBILE_PUSH.easProjectId })
    : await Notifications.getExpoPushTokenAsync();
  await registerMobilePushToken(businessId, tokenResponse.data);
  return { ok: true };
}
