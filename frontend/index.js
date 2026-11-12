// The app's entry on the phone: Expo Router as usual (the browser has its own, index.web.js).
import { Platform } from "react-native";
import "expo-router/entry";

// Home-screen widgets and the hourly background sync: Android starts this code without opening the app, so they
// are registered here, not in a screen.
if (Platform.OS === "android") require("./src/widgets/register");
