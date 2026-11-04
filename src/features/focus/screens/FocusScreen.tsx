import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { notification } from "@/components/notifications";
import { ProgressBar } from "@/components/ProgressBar";
import { SwitchRow } from "@/components/SwitchRow";
import { Chip } from "@/features/focus/components/Chip";
import {
	formatClock,
	PHASE_LABEL,
	phaseMinutes,
} from "@/features/focus/pomodoro";
import { phaseEndsAt, useFocusStore } from "@/features/focus/stores/FocusStore";
import { buildTargetOptions, toTarget } from "@/features/focus/targets";
import { getBlockStatuses } from "@/features/routine/blockStatus";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { POMODORO_CYCLES_UNTIL_LONG_BREAK } from "@/types";
import { formatMinutes, minutesOfDate } from "@/utils/time";
import { useNow } from "@/utils/useNow";
import { hasWeekday } from "@/utils/weekdays";

export function FocusScreen() {
	const db = useSQLiteContext();
	const colors = useThemeColors();
	const now = useNow(1000);
	const nowMs = now.getTime();

	const phase = useFocusStore((state) => state.phase);
	const cycleCount = useFocusStore((state) => state.cycleCount);
	const onFocusEnd = useFocusStore((state) => state.onFocusEnd);
	const today = useFocusStore((state) => state.today);
	const weekMinutes = useFocusStore((state) => state.weekMinutes);
	const taskPrompt = useFocusStore((state) => state.taskPrompt);
	const notice = useFocusStore((state) => state.notice);
	const isLoaded = useFocusStore((state) => state.isLoaded);
	const actions = useFocusStore.getState;

	const blocks = useRoutineStore((state) => state.blocks);
	const tasks = useRoutineStore((state) => state.tasks);
	const goals = useRoutineStore((state) => state.goals);
	const routineLoaded = useRoutineStore((state) => state.isLoaded);

	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
	const [confirmingCancel, setConfirmingCancel] = useState(false);

	useEffect(() => {
		if (!isLoaded) {
			actions()
				.load(db)
				.catch(() => notification.error("Não foi possível carregar o foco."));
		}
		if (!routineLoaded) {
			useRoutineStore
				.getState()
				.load(db)
				.catch(() => notification.error("Não foi possível carregar a rotina."));
		}
	}, [db, isLoaded, routineLoaded, actions]);

	// O timer do store não roda com o app em segundo plano: ao voltar, fecha a fase vencida.
	useEffect(() => {
		if (phase && nowMs >= phaseEndsAt(phase)) {
			actions()
				.finishPhase(db, nowMs)
				.catch(() => notification.error("Não foi possível salvar o foco."));
		}
	}, [db, phase, nowMs, actions]);

	useEffect(() => {
		if (!notice) return;
		notification.success(notice);
		actions().clearNotice();
	}, [notice, actions]);

	const currentBlock = useMemo(() => {
		const todayBlocks = blocks.filter((block) =>
			hasWeekday(block.weekdays, now.getDay()),
		);
		const statuses = getBlockStatuses(todayBlocks, minutesOfDate(now));
		return (
			todayBlocks.find((block) => statuses.get(block.id) === "current") ?? null
		);
	}, [blocks, now]);

	const options = useMemo(
		() => buildTargetOptions(currentBlock, goals, tasks),
		[currentBlock, goals, tasks],
	);
	const option = options.find((item) => item.key === selectedKey) ?? options[0];
	const pendingTasks = useMemo(
		() =>
			option?.activity
				? tasks.filter((task) => !task.done && task.section === option.activity)
				: [],
		[tasks, option],
	);

	const remainingMs = phase ? phaseEndsAt(phase) - nowMs : 0;
	const progress = phase ? 1 - remainingMs / phase.durationMs : 0;

	async function run(action: () => Promise<void>, error: string) {
		try {
			await action();
		} catch {
			notification.error(error);
		}
	}

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<View
				style={[
					styles.timerCard,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.phase, { color: colors.primary }]}>
					{phase ? PHASE_LABEL[phase.kind] : "Pronto para focar"}
				</Text>
				<Text
					accessibilityRole="timer"
					style={[styles.clock, { color: colors.textPrimary }]}
				>
					{formatClock(phase ? remainingMs : phaseMinutes("focus") * 60_000)}
				</Text>
				{phase ? (
					<ProgressBar value={progress} label="Progresso da fase" />
				) : null}
				{phase?.target.activity ? (
					<Text style={[styles.caption, { color: colors.textMuted }]}>
						{phase.target.activity}
					</Text>
				) : null}
				<View
					accessibilityLabel={`${cycleCount} de ${POMODORO_CYCLES_UNTIL_LONG_BREAK} focos no ciclo`}
					style={styles.dots}
				>
					{Array.from({ length: POMODORO_CYCLES_UNTIL_LONG_BREAK }, (_, i) => (
						<View
							key={i}
							style={[
								styles.dot,
								{
									backgroundColor:
										i < cycleCount ? colors.primary : "transparent",
									borderColor: colors.primary,
								},
							]}
						/>
					))}
				</View>
			</View>

			{phase ? (
				phase.kind === "focus" ? (
					<ActionButton
						title="Cancelar foco"
						variant="secondary"
						onPress={() => setConfirmingCancel(true)}
					/>
				) : (
					<ActionButton
						title="Pular pausa"
						variant="secondary"
						onPress={() => actions().skipBreak()}
					/>
				)
			) : (
				<>
					<Text style={[styles.heading, { color: colors.textPrimary }]}>
						No que você vai focar?
					</Text>
					<View style={styles.chips} accessibilityRole="radiogroup">
						{options.map((item) => (
							<Chip
								key={item.key}
								label={item.label}
								selected={item.key === option?.key}
								onPress={() => {
									setSelectedKey(item.key);
									setSelectedTaskId(null);
								}}
							/>
						))}
					</View>
					{pendingTasks.length > 0 ? (
						<>
							<Text style={[styles.heading, { color: colors.textPrimary }]}>
								Tarefa (opcional)
							</Text>
							<View style={styles.chips} accessibilityRole="radiogroup">
								{pendingTasks.map((task) => (
									<Chip
										key={task.id}
										label={task.title}
										selected={task.id === selectedTaskId}
										onPress={() =>
											setSelectedTaskId(
												task.id === selectedTaskId ? null : task.id,
											)
										}
									/>
								))}
							</View>
						</>
					) : null}
					<ActionButton
						title={`Iniciar foco (${phaseMinutes("focus")} min)`}
						onPress={() =>
							run(
								() =>
									actions().startFocus(db, toTarget(option, selectedTaskId)),
								"Não foi possível iniciar o foco.",
							)
						}
					/>
				</>
			)}

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.heading, { color: colors.textPrimary }]}>
					Hoje
				</Text>
				<Text style={[styles.caption, { color: colors.textMuted }]}>
					{today.sessions === 0
						? "Nenhum foco concluído ainda."
						: `${today.sessions} ${today.sessions === 1 ? "foco" : "focos"} · ${formatMinutes(today.minutes)}`}
				</Text>
			</View>

			{goals.length > 0 ? (
				<View
					style={[
						styles.card,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
				>
					<Text style={[styles.heading, { color: colors.textPrimary }]}>
						Metas da semana
					</Text>
					{goals.map((goal) => {
						const done = weekMinutes[goal.activity] ?? 0;
						return (
							<View key={goal.id} style={styles.goal}>
								<View style={styles.goalHeader}>
									<Text
										style={[styles.goalName, { color: colors.textPrimary }]}
									>
										{goal.activity}
									</Text>
									<Text
										style={[
											styles.caption,
											styles.goalValue,
											{ color: colors.textMuted },
										]}
									>
										{formatMinutes(done)} / {formatMinutes(goal.targetMinutes)}
									</Text>
								</View>
								<ProgressBar
									value={goal.targetMinutes > 0 ? done / goal.targetMinutes : 0}
									label={`Meta de ${goal.activity}`}
								/>
							</View>
						);
					})}
				</View>
			) : null}

			<SwitchRow
				label="Concluir a tarefa sozinho"
				description="Ao fim do foco, marca a tarefa escolhida como feita. Desligado, o app pergunta antes."
				value={onFocusEnd === "auto_complete"}
				onValueChange={(value) =>
					run(
						() =>
							actions().changeOnFocusEnd(db, value ? "auto_complete" : "ask"),
						"Não foi possível salvar a preferência.",
					)
				}
			/>

			<ConfirmModal
				visible={confirmingCancel}
				title="Cancelar o foco?"
				message="O tempo desta sessão não conta para as metas."
				confirmLabel="Cancelar foco"
				cancelLabel="Continuar"
				onCancel={() => setConfirmingCancel(false)}
				onConfirm={() => {
					setConfirmingCancel(false);
					run(
						() => actions().cancelPhase(db),
						"Não foi possível cancelar o foco.",
					);
				}}
			/>
			<ConfirmModal
				visible={taskPrompt !== null}
				title="Concluir a tarefa?"
				message={`Marcar «${taskPrompt?.title ?? ""}» como concluída?`}
				confirmLabel="Concluir"
				cancelLabel="Ainda não"
				onCancel={() => actions().dismissTaskPrompt()}
				onConfirm={() =>
					run(
						() => actions().confirmTaskPrompt(db),
						"Não foi possível concluir a tarefa.",
					)
				}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	timerCard: {
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.lg,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	phase: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	clock: {
		fontSize: 64,
		fontWeight: fontWeight.bold,
		fontVariant: ["tabular-nums"],
	},
	dots: { flexDirection: "row", gap: spacing.sm },
	dot: { width: 14, height: 14, borderWidth: 2, borderRadius: 7 },
	heading: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	caption: { fontSize: fontSize.caption, lineHeight: 20 },
	card: {
		gap: spacing.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	goal: { gap: spacing.xs },
	goalHeader: { gap: spacing.xs },
	goalName: { fontSize: fontSize.body },
	goalValue: { textAlign: "left" },
});
