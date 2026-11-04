import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "@/utils/weekdays";

interface DaySelectorProps {
	selected: number;
	today: number;
	onSelect: (day: number) => void;
}

export function DaySelector({ selected, today, onSelect }: DaySelectorProps) {
	const colors = useThemeColors();

	return (
		<View style={styles.row}>
			{WEEKDAY_SHORT.map((label, day) => {
				const isSelected = day === selected;
				return (
					<Pressable
						key={label}
						accessibilityRole="button"
						accessibilityLabel={
							day === today ? `${WEEKDAY_LONG[day]} (hoje)` : WEEKDAY_LONG[day]
						}
						accessibilityState={{ selected: isSelected }}
						onPress={() => onSelect(day)}
						style={[
							styles.day,
							{
								backgroundColor: isSelected ? colors.primary : colors.surface,
								borderColor: day === today ? colors.primary : colors.border,
							},
						]}
					>
						<Text
							style={[
								styles.label,
								{ color: isSelected ? colors.background : colors.textPrimary },
							]}
						>
							{label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: spacing.xs },
	day: {
		flex: 1,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	label: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
});
