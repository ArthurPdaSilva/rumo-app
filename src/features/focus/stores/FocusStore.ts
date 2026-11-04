import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	abandonOpenSessions,
	finishFocusSession,
	getFocusStats,
	getMinutesByActivity,
	getOnFocusEnd,
	setOnFocusEnd,
	startFocusSession,
} from "@/database/repositories/pomodoroRepository";
import { setTaskDone } from "@/database/repositories/routineRepository";
import {
	breakAfterFocus,
	PHASE_LABEL,
	type PhaseKind,
	phaseDurationMs,
	phaseMinutes,
} from "@/features/focus/pomodoro";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";
import type { PomodoroOnFocusEnd } from "@/types";
import { dayRange, weekRange } from "@/utils/week";

export interface FocusTarget {
	activity: string | null;
	routineBlockId: number | null;
	taskId: number | null;
}

export interface ActivePhase {
	kind: PhaseKind;
	startedAtMs: number;
	durationMs: number;
	/** Só o foco é gravado no banco; pausas ficam só em memória. */
	sessionId: number | null;
	target: FocusTarget;
}

interface FocusState {
	phase: ActivePhase | null;
	/** Focos concluídos desde a última pausa longa. */
	cycleCount: number;
	onFocusEnd: PomodoroOnFocusEnd;
	today: { sessions: number; minutes: number };
	weekMinutes: Record<string, number>;
	/** Pergunta pendente "concluir a tarefa?" (modo `ask`). */
	taskPrompt: { taskId: number; title: string } | null;
	/** Aviso para a tela mostrar como toast uma vez. */
	notice: string | null;
	isLoaded: boolean;
	load: (db: Database, nowMs?: number) => Promise<void>;
	startFocus: (
		db: Database,
		target: FocusTarget,
		nowMs?: number,
	) => Promise<void>;
	finishPhase: (db: Database, nowMs?: number) => Promise<void>;
	cancelPhase: (db: Database, nowMs?: number) => Promise<void>;
	skipBreak: () => void;
	changeOnFocusEnd: (db: Database, value: PomodoroOnFocusEnd) => Promise<void>;
	confirmTaskPrompt: (db: Database) => Promise<void>;
	dismissTaskPrompt: () => void;
	clearNotice: () => void;
	reset: () => void;
}

const initialState = {
	phase: null,
	cycleCount: 0,
	onFocusEnd: "ask" as PomodoroOnFocusEnd,
	today: { sessions: 0, minutes: 0 },
	weekMinutes: {},
	taskPrompt: null,
	notice: null,
	isLoaded: false,
};

let timer: ReturnType<typeof setTimeout> | null = null;
let finishing = false;

function clearTimer() {
	if (timer) clearTimeout(timer);
	timer = null;
}

export function phaseEndsAt(phase: ActivePhase): number {
	return phase.startedAtMs + phase.durationMs;
}

function markTaskDoneInRoutineStore(taskId: number) {
	useRoutineStore.setState((state) => ({
		tasks: state.tasks.map((task) =>
			task.id === taskId ? { ...task, done: true } : task,
		),
	}));
}

export const useFocusStore = create<FocusState>((set, get) => {
	async function refreshStats(db: Database, nowMs: number) {
		const now = new Date(nowMs);
		const day = dayRange(now);
		const week = weekRange(now);
		const [today, weekMinutes] = await Promise.all([
			getFocusStats(db, day.start, day.end),
			getMinutesByActivity(db, week.start, week.end),
		]);
		set({ today, weekMinutes });
	}

	function begin(db: Database, phase: ActivePhase) {
		clearTimer();
		set({ phase });
		const wait = Math.max(0, phaseEndsAt(phase) - Date.now());
		timer = setTimeout(() => {
			get()
				.finishPhase(db)
				.catch(() => undefined);
		}, wait);
	}

	return {
		...initialState,
		load: async (db, nowMs = Date.now()) => {
			// Uma sessão aberta sem fase em memória é resto de um encerramento do app.
			if (!get().phase) await abandonOpenSessions(db);
			const onFocusEnd = await getOnFocusEnd(db);
			await refreshStats(db, nowMs);
			set({ onFocusEnd, isLoaded: true });
		},
		startFocus: async (db, target, nowMs = Date.now()) => {
			if (get().phase) return;
			const sessionId = await startFocusSession(db, {
				startedAt: new Date(nowMs).toISOString(),
				activity: target.activity,
				routineBlockId: target.routineBlockId,
				taskId: target.taskId,
			});
			begin(db, {
				kind: "focus",
				startedAtMs: nowMs,
				durationMs: phaseDurationMs("focus"),
				sessionId,
				target,
			});
		},
		finishPhase: async (db, nowMs = Date.now()) => {
			const phase = get().phase;
			if (!phase || finishing || nowMs < phaseEndsAt(phase)) return;
			finishing = true;
			try {
				clearTimer();
				if (phase.kind !== "focus") {
					if (phase.kind === "longBreak") set({ cycleCount: 0 });
					set({
						phase: null,
						notice: "Pausa terminada. Pronto para outro foco?",
					});
					return;
				}

				if (phase.sessionId !== null) {
					await finishFocusSession(
						db,
						phase.sessionId,
						new Date(phaseEndsAt(phase)).toISOString(),
						true,
					);
				}
				const cycleCount = get().cycleCount + 1;
				const nextKind = breakAfterFocus(cycleCount);
				let notice = `Foco concluído! ${PHASE_LABEL[nextKind]} de ${phaseMinutes(nextKind)} min.`;
				let taskPrompt: FocusState["taskPrompt"] = null;

				const { taskId } = phase.target;
				const task =
					taskId === null
						? undefined
						: useRoutineStore
								.getState()
								.tasks.find((item) => item.id === taskId);
				if (task && !task.done) {
					if (get().onFocusEnd === "auto_complete") {
						await setTaskDone(db, task.id, true);
						markTaskDoneInRoutineStore(task.id);
						notice = `${notice} Tarefa «${task.title}» concluída.`;
					} else {
						taskPrompt = { taskId: task.id, title: task.title };
					}
				}

				set({ cycleCount, notice, taskPrompt });
				await refreshStats(db, nowMs);
				begin(db, {
					kind: nextKind,
					startedAtMs: nowMs,
					durationMs: phaseDurationMs(nextKind),
					sessionId: null,
					target: phase.target,
				});
			} finally {
				finishing = false;
			}
		},
		cancelPhase: async (db, nowMs = Date.now()) => {
			const phase = get().phase;
			if (!phase) return;
			clearTimer();
			set({ phase: null });
			if (phase.kind === "focus") {
				if (phase.sessionId !== null) {
					await finishFocusSession(
						db,
						phase.sessionId,
						new Date(nowMs).toISOString(),
						false,
					);
				}
			} else if (phase.kind === "longBreak") {
				set({ cycleCount: 0 });
			}
		},
		skipBreak: () => {
			const phase = get().phase;
			if (!phase || phase.kind === "focus") return;
			clearTimer();
			set({
				phase: null,
				...(phase.kind === "longBreak" ? { cycleCount: 0 } : {}),
			});
		},
		changeOnFocusEnd: async (db, value) => {
			await setOnFocusEnd(db, value);
			set({ onFocusEnd: value });
		},
		confirmTaskPrompt: async (db) => {
			const prompt = get().taskPrompt;
			if (!prompt) return;
			await setTaskDone(db, prompt.taskId, true);
			markTaskDoneInRoutineStore(prompt.taskId);
			set({ taskPrompt: null, notice: "Tarefa concluída." });
		},
		dismissTaskPrompt: () => set({ taskPrompt: null }),
		clearNotice: () => set({ notice: null }),
		reset: () => {
			clearTimer();
			finishing = false;
			set({ ...initialState });
		},
	};
});
