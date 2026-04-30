// Stack imbriqué pour les pages album — permet à la tabbar de rester visible
import { Stack } from "expo-router";
export default function AlbumLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
