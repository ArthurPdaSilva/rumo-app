import { Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

interface ChipProps {
	label: string;
	selected: boolean;
	onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
	const colors = useThemeColors();

	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[
				styles.chip,
				{
					backgroundColor: selected ? colors.primary : colors.surface,
					borderColor: selected ? colors.primary : colors.border,
				},
			]}
		>
			<Text
				style={[
					styles.label,
					{ color: selected ? colors.background : colors.textPrimary },
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	chip: {
		minHeight: 44,
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.pill,
		paddingHorizontal: spacing.md,
	},
	label: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
});
