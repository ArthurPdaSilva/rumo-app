import { Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

interface ActionButtonProps {
	title: string;
	onPress: () => void;
	variant?: "primary" | "secondary";
	disabled?: boolean;
}

export function ActionButton({
	title,
	onPress,
	variant = "primary",
	disabled = false,
}: ActionButtonProps) {
	const colors = useThemeColors();
	const isPrimary = variant === "primary";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				{
					backgroundColor: isPrimary ? colors.primary : "transparent",
					borderColor: colors.primary,
					opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
				},
			]}
		>
			<Text
				style={[
					styles.title,
					{ color: isPrimary ? colors.background : colors.primary },
				]}
			>
				{title}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.md,
		paddingHorizontal: spacing.lg,
	},
	title: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
});
