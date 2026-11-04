import { StyleSheet, View } from "react-native";
import { useThemeColors } from "@/styles/theme";
import { borderRadius } from "@/styles/tokens";

interface ProgressBarProps {
	/** Valor entre 0 e 1; fora disso é limitado. */
	value: number;
	label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
	const colors = useThemeColors();
	const clamped = Math.min(1, Math.max(0, value));

	return (
		<View
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
			style={[styles.track, { backgroundColor: colors.border }]}
		>
			<View
				style={[
					styles.fill,
					{ width: `${clamped * 100}%`, backgroundColor: colors.primary },
				]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	track: { height: 10, borderRadius: borderRadius.pill, overflow: "hidden" },
	fill: { height: "100%", borderRadius: borderRadius.pill },
});
