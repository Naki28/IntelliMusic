// Stack imbriqué pour les pages artiste — permet à la tabbar de rester visible
import { Stack } from "expo-router";
export default function ArtistLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
