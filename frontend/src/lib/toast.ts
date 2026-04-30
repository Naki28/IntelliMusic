// showToast — Toast cross-platform léger (Android natif, iOS/Web fallback Alert court)
import { ToastAndroid, Platform, Alert } from "react-native";

export function showToast(msg: string) {
  if (Platform.OS === "android") {
    try { ToastAndroid.show(msg, ToastAndroid.SHORT); return; } catch {}
  }
  try { Alert.alert("", msg); } catch {}
}
