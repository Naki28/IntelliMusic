// Stack imbriqué pour les pages playlist — permet à la tabbar de rester visible
import { Stack } from "expo-router";
export default function PlaylistLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
