import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
	Pressable,
	ScrollView,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { getBlockStatuses } from "@/features/routine/blockStatus";
import { BlockCard } from "@/features/routine/components/BlockCard";
import { DaySelector } from "@/features/routine/components/DaySelector";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { formatMinutes, minutesOfDate } from "@/utils/time";
import { useNow } from "@/utils/useNow";
import { hasWeekday, WEEKDAY_LONG } from "@/utils/weekdays";

type Segment = "day" | "tasks" | "goals";

const SEGMENTS: { key: Segment; label: string }[] = [
	{ key: "day", label: "Dia" },
	{ key: "tasks", label: "Tarefas" },
	{ key: "goals", label: "Metas" },
];

export function RoutineScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const now = useNow();
	const blocks = useRoutineStore((state) => state.blocks);
	const tasks = useRoutineStore((state) => state.tasks);
	const goals = useRoutineStore((state) => state.goals);
	const isLoaded = useRoutineStore((state) => state.isLoaded);
	const load = useRoutineStore((state) => state.load);
	const toggleTask = useRoutineStore((state) => state.toggleTask);
	const [segment, setSegment] = useState<Segment>("day");
	const [selectedDay, setSelectedDay] = useState(() => now.getDay());
	const today = now.getDay();

	useEffect(() => {
		if (isLoaded) return;
		load(db).catch(() => {
			notification.error("Não foi possível carregar a sua rotina.");
		});
	}, [db, isLoaded, load]);

	const dayBlocks = useMemo(
		() => blocks.filter((block) => hasWeekday(block.weekdays, selectedDay)),
		[blocks, selectedDay],
	);
	const statuses = useMemo(
		() =>
			selectedDay === today
				? getBlockStatuses(dayBlocks, minutesOfDate(now))
				: new Map(),
		[dayBlocks, selectedDay, today, now],
	);
	const sections = useMemo(() => {
		const groups = new Map<string, typeof tasks>();
		for (const task of tasks) {
			groups.set(task.section, [...(groups.get(task.section) ?? []), task]);
		}
		return [...groups.entries()].map(([title, data]) => ({
			title,
			done: data.filter((task) => task.done).length,
			data,
		}));
	}, [tasks]);

	async function onToggle(id: number) {
		try {
			const done = await toggleTask(db, id);
			notification.success(done ? "Tarefa concluída." : "Tarefa reaberta.");
		} catch {
			notification.error("Não foi possível atualizar a tarefa.");
		}
	}

	const emptyText = (title: string, text: string) => (
		<View style={styles.empty}>
			<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
				{title}
			</Text>
			<Text style={[styles.emptyText, { color: colors.textMuted }]}>
				{text}
			</Text>
		</View>
	);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<View style={styles.segments}>
				{SEGMENTS.map((item) => {
					const selected = item.key === segment;
					return (
						<Pressable
							key={item.key}
							accessibilityRole="tab"
							accessibilityState={{ selected }}
							onPress={() => setSegment(item.key)}
							style={[
								styles.segment,
								{
									backgroundColor: selected ? colors.primary : colors.surface,
									borderColor: selected ? colors.primary : colors.border,
								},
							]}
						>
							<Text
								style={[
									styles.segmentText,
									{ color: selected ? colors.background : colors.textPrimary },
								]}
							>
								{item.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{segment === "day" ? (
				<ScrollView contentContainerStyle={styles.content}>
					<DaySelector
						selected={selectedDay}
						today={today}
						onSelect={setSelectedDay}
					/>
					<Text style={[styles.heading, { color: colors.textPrimary }]}>
						{WEEKDAY_LONG[selectedDay]}
						{selectedDay === today ? " (hoje)" : ""}
					</Text>
					{dayBlocks.map((block) => (
						<BlockCard
							key={block.id}
							block={block}
							status={statuses.get(block.id)}
							onPress={() =>
								router.push({
									pathname: "/blocks/[id]",
									params: { id: String(block.id) },
								})
							}
						/>
					))}
					{isLoaded && dayBlocks.length === 0
						? emptyText(
								"Nenhum bloco neste dia",
								"Crie um bloco ou importe um arquivo .db pelo Perfil.",
							)
						: null}
					<ActionButton
						title="Adicionar bloco"
						onPress={() =>
							router.push({
								pathname: "/blocks/new",
								params: { weekday: String(selectedDay) },
							})
						}
					/>
				</ScrollView>
			) : null}

			{segment === "tasks" ? (
				<SectionList
					sections={sections}
					keyExtractor={(task) => String(task.id)}
					contentContainerStyle={styles.content}
					stickySectionHeadersEnabled={false}
					ListEmptyComponent={
						isLoaded
							? emptyText(
									"Nenhuma tarefa",
									"Importe um arquivo .db pelo Perfil para trazer as suas tarefas.",
								)
							: undefined
					}
					renderSectionHeader={({ section }) => (
						<Text style={[styles.heading, { color: colors.textPrimary }]}>
							{section.title} ({section.done}/{section.data.length})
						</Text>
					)}
					renderItem={({ item }) => (
						<Pressable
							accessibilityRole="checkbox"
							accessibilityLabel={item.title}
							accessibilityState={{ checked: item.done }}
							onPress={() => onToggle(item.id)}
							style={[
								styles.task,
								{ backgroundColor: colors.surface, borderColor: colors.border },
							]}
						>
							<View
								style={[
									styles.checkbox,
									{
										borderColor: colors.primary,
										backgroundColor: item.done ? colors.primary : "transparent",
									},
								]}
							/>
							<Text
								style={[
									styles.taskText,
									{
										color: item.done ? colors.textMuted : colors.textPrimary,
										textDecorationLine: item.done ? "line-through" : "none",
									},
								]}
							>
								{item.title}
							</Text>
						</Pressable>
					)}
				/>
			) : null}

			{segment === "goals" ? (
				<ScrollView contentContainerStyle={styles.content}>
					{goals.map((goal) => (
						<View
							key={goal.id}
							style={[
								styles.goal,
								{ backgroundColor: colors.surface, borderColor: colors.border },
							]}
						>
							<Text style={[styles.goalTitle, { color: colors.textPrimary }]}>
								{goal.activity}
							</Text>
							<Text style={[styles.goalValue, { color: colors.primary }]}>
								{formatMinutes(goal.targetMinutes)} por semana
							</Text>
							{goal.note ? (
								<Text style={[styles.emptyText, { color: colors.textMuted }]}>
									{goal.note}
								</Text>
							) : null}
						</View>
					))}
					{isLoaded && goals.length === 0
						? emptyText(
								"Nenhuma meta semanal",
								"Importe um arquivo .db pelo Perfil para trazer as suas metas.",
							)
						: null}
					{goals.length > 0 ? (
						<Text style={[styles.emptyText, { color: colors.textMuted }]}>
							O progresso de cada meta aparece na aba Foco, conforme você
							conclui sessões.
						</Text>
					) : null}
				</ScrollView>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	segments: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
	segment: {
		flex: 1,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.pill,
	},
	segmentText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	content: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
	heading: {
		fontSize: fontSize.body,
		fontWeight: fontWeight.bold,
		paddingTop: spacing.sm,
	},
	empty: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
	emptyTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	emptyText: { fontSize: fontSize.caption, lineHeight: 20 },
	task: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		minHeight: 48,
		marginBottom: spacing.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 6 },
	taskText: { flex: 1, fontSize: fontSize.body },
	goal: {
		gap: spacing.xs,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	goalTitle: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
	goalValue: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
});
