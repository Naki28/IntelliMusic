// Stack imbriqué pour les pages podcast — permet à la tabbar de rester visible
import { Stack } from "expo-router";
export default function PodcastLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
