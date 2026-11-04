import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toAddictionIcon } from "@/features/addictions/icons";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import type { Addiction } from "@/types";
import { formatStreak, getNextMilestone, getStreak } from "@/utils/streak";

interface AddictionCardProps {
	addiction: Addiction;
	now: Date;
	onPress: () => void;
}

export function AddictionCard({ addiction, now, onPress }: AddictionCardProps) {
	const colors = useThemeColors();
	const streak = getStreak(addiction.streakStartedAt, now);
	const nextMilestone = getNextMilestone(streak.days);
	const progress = nextMilestone ? Math.min(1, streak.days / nextMilestone) : 1;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${addiction.name}, ${formatStreak(streak)} sem ceder`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<MaterialCommunityIcons
				name={toAddictionIcon(addiction.icon)}
				size={32}
				color={colors.primary}
			/>
			<View style={styles.body}>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					{addiction.name}
				</Text>
				<Text style={[styles.streak, { color: colors.primary }]}>
					{formatStreak(streak)} sem ceder
				</Text>
				<View style={[styles.track, { backgroundColor: colors.border }]}>
					<View
						style={[
							styles.fill,
							{
								width: `${Math.round(progress * 100)}%`,
								backgroundColor: colors.primary,
							},
						]}
					/>
				</View>
				<Text style={[styles.caption, { color: colors.textMuted }]}>
					{nextMilestone
						? `Próximo marco: ${nextMilestone} dias`
						: "Todos os marcos alcançados"}
				</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	body: { flex: 1, gap: spacing.xs },
	name: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	streak: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
	track: { height: 6, borderRadius: borderRadius.pill, overflow: "hidden" },
	fill: { height: 6, borderRadius: borderRadius.pill },
	caption: { fontSize: fontSize.caption },
});
