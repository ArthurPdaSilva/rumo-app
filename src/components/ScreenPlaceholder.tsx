import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/tokens";

interface ScreenPlaceholderProps {
	icon: keyof typeof MaterialCommunityIcons.glyphMap;
	title: string;
	description: string;
}

export function ScreenPlaceholder({
	icon,
	title,
	description,
}: ScreenPlaceholderProps) {
	const colors = useThemeColors();

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<MaterialCommunityIcons name={icon} size={56} color={colors.primary} />
			<Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
			<Text style={[styles.description, { color: colors.textMuted }]}>
				{description}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.md,
		padding: spacing.lg,
	},
	title: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
	description: { fontSize: fontSize.body, textAlign: "center" },
});
