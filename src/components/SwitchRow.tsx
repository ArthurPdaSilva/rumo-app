import { StyleSheet, Switch, Text, View } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/tokens";

interface SwitchRowProps {
	label: string;
	description?: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
}

export function SwitchRow({
	label,
	description,
	value,
	onValueChange,
}: SwitchRowProps) {
	const colors = useThemeColors();

	return (
		<View style={styles.row}>
			<View style={styles.texts}>
				<Text style={[styles.label, { color: colors.textPrimary }]}>
					{label}
				</Text>
				{description ? (
					<Text style={[styles.description, { color: colors.textMuted }]}>
						{description}
					</Text>
				) : null}
			</View>
			<Switch
				accessibilityLabel={label}
				value={value}
				onValueChange={onValueChange}
				trackColor={{ true: colors.primary, false: colors.border }}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},
	texts: { flex: 1, gap: spacing.xs },
	label: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
	description: { fontSize: fontSize.caption },
});
