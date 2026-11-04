import { useColorScheme } from "react-native";
import { darkColors, lightColors, type ThemeColors } from "@/styles/tokens";

export function useThemeColors(): ThemeColors {
	return useColorScheme() === "dark" ? darkColors : lightColors;
}
