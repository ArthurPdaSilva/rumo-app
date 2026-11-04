import { Pressable, StyleSheet, Text, View } from "react-native";
import {
	type BlockStatus,
	formatTimeRange,
} from "@/features/routine/blockStatus";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import type { RoutineBlock } from "@/types";

interface BlockCardProps {
	block: RoutineBlock;
	status?: BlockStatus;
	onPress: () => void;
}

const STATUS_LABEL: Partial<Record<BlockStatus, string>> = {
	current: "Agora",
	next: "Próximo",
};

export function BlockCard({ block, status, onPress }: BlockCardProps) {
	const colors = useThemeColors();
	const range = formatTimeRange(block);
	const badge = status ? STATUS_LABEL[status] : undefined;
	const highlighted = status === "current";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${range}, ${block.title}${badge ? `, ${badge.toLowerCase()}` : ""}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: highlighted ? colors.primary : colors.border,
					borderWidth: highlighted ? 2 : 1,
					opacity: status === "past" ? 0.6 : pressed ? 0.85 : 1,
				},
			]}
		>
			<Text style={[styles.time, { color: colors.primary }]}>{range}</Text>
			<View style={styles.texts}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					{block.title}
				</Text>
				<Text style={[styles.meta, { color: colors.textMuted }]}>
					{block.reminderMinutes > 0
						? `Lembrete ${block.reminderMinutes} min antes`
						: "Sem lembrete"}
				</Text>
			</View>
			{badge ? (
				<Text
					style={[
						styles.badge,
						{ backgroundColor: colors.primary, color: colors.background },
					]}
				>
					{badge}
				</Text>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
		borderRadius: borderRadius.lg,
	},
	time: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, width: 92 },
	texts: { flex: 1, gap: spacing.xs },
	title: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
	meta: { fontSize: fontSize.caption },
	badge: {
		fontSize: fontSize.caption,
		fontWeight: fontWeight.bold,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.pill,
		overflow: "hidden",
	},
});
