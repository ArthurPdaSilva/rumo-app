import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	type ActivePhaseRow,
	abandonOpenSessions,
	finishFocusSession,
	getActivePhase,
	getFocusStats,
	getMinutesByActivity,
	getOnFocusEnd,
	saveActivePhase,
	setOnFocusEnd,
	startFocusSession,
} from "@/database/repositories/pomodoroRepository";
import { setTaskDone } from "@/database/repositories/routineRepository";
import {
	breakAfterFocus,
	isPhaseExpired,
	PHASE_LABEL,
	type PhaseKind,
	phaseDurationMs,
	phaseEndsAtMs,
	phaseMinutes,
} from "@/features/focus/pomodoro";
import {
	applyPomodoroAction,
	notifyActivePhase,
} from "@/features/focus/pomodoroActions";
import { settlePomodoroLive } from "@/features/notifications/pomodoroAlerts";
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
	/** Quando a pausa em curso começou; `null` com a fase correndo. */
	pausedAtMs: number | null;
	/** Soma das pausas já encerradas, que empurram o fim da fase. */
	pausedTotalMs: number;
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
	/** Relê a fase ativa do banco: a notificação pode tê-la mudado com o app fechado. */
	restore: (db: Database, nowMs?: number) => Promise<void>;
	startFocus: (
		db: Database,
		target: FocusTarget,
		nowMs?: number,
	) => Promise<void>;
	pausePhase: (db: Database, nowMs?: number) => Promise<void>;
	resumePhase: (db: Database, nowMs?: number) => Promise<void>;
	finishPhase: (db: Database, nowMs?: number) => Promise<void>;
	cancelPhase: (db: Database, nowMs?: number) => Promise<void>;
	skipBreak: (db: Database, nowMs?: number) => Promise<void>;
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

/** Quantas fases vencidas seguidas (foco, pausa...) são fechadas de uma vez ao voltar ao app. */
const MAX_CATCH_UP_PHASES = 6;

let timer: ReturnType<typeof setTimeout> | null = null;
let finishing = false;

function clearTimer() {
	if (timer) clearTimeout(timer);
	timer = null;
}

export function phaseEndsAt(phase: ActivePhase): number {
	return phaseEndsAtMs(phase);
}

/** Avisos em segundo plano são um extra: falhar aqui nunca pode travar o foco. */
function bestEffort(task: Promise<unknown>) {
	task.catch(() => undefined);
}

function toRow(phase: ActivePhase, cycleCount: number): ActivePhaseRow {
	return {
		kind: phase.kind,
		startedAtMs: phase.startedAtMs,
		durationMs: phase.durationMs,
		sessionId: phase.sessionId,
		activity: phase.target.activity,
		routineBlockId: phase.target.routineBlockId,
		taskId: phase.target.taskId,
		pausedAtMs: phase.pausedAtMs,
		pausedTotalMs: phase.pausedTotalMs,
		cycleCount,
	};
}

function fromRow(row: ActivePhaseRow): ActivePhase {
	return {
		kind: row.kind,
		startedAtMs: row.startedAtMs,
		durationMs: row.durationMs,
		pausedAtMs: row.pausedAtMs,
		pausedTotalMs: row.pausedTotalMs,
		sessionId: row.sessionId,
		target: {
			activity: row.activity,
			routineBlockId: row.routineBlockId,
			taskId: row.taskId,
		},
	};
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

	/** Mantém o timer de tela; uma fase pausada não tem fim marcado. */
	function arm(db: Database, phase: ActivePhase) {
		clearTimer();
		if (phase.pausedAtMs !== null) return;
		const wait = Math.max(0, phaseEndsAtMs(phase) - Date.now());
		timer = setTimeout(() => {
			get()
				.finishPhase(db)
				.catch(() => undefined);
		}, wait);
	}

	/** Grava a fase no banco antes de mostrá-la: ela precisa sobreviver ao app ser encerrado. */
	async function begin(db: Database, phase: ActivePhase) {
		await saveActivePhase(db, toRow(phase, get().cycleCount));
		set({ phase });
		arm(db, phase);
	}

	/**
	 * Faz a store refletir a fase ativa do banco. `notify` refaz a notificação
	 * fixa e os avisos (ao abrir o app); fica desligado quando quem chama acabou
	 * de fazê-lo. Fases vencidas enquanto o app estava parado são fechadas aqui.
	 */
	async function adopt(
		db: Database,
		row: ActivePhaseRow | null,
		nowMs: number,
		notify: boolean,
	) {
		if (!row) {
			clearTimer();
			if (get().phase) set({ phase: null });
			return;
		}
		const phase = fromRow(row);
		set({ phase, cycleCount: row.cycleCount });
		arm(db, phase);
		if (notify && !isPhaseExpired(phase, nowMs)) {
			bestEffort(notifyActivePhase(row, undefined, nowMs));
		}

		// O app pode ter ficado parado por várias fases seguidas.
		for (let i = 0; i < MAX_CATCH_UP_PHASES; i++) {
			const current = get().phase;
			if (!current || !isPhaseExpired(current, nowMs)) break;
			await get().finishPhase(db, nowMs);
		}
	}

	return {
		...initialState,
		load: async (db, nowMs = Date.now()) => {
			await get().restore(db, nowMs);
			// Uma sessão aberta que nenhuma fase reivindica é resto de um encerramento do app.
			if (!get().phase) await abandonOpenSessions(db);
			const onFocusEnd = await getOnFocusEnd(db);
			await refreshStats(db, nowMs);
			set({ onFocusEnd, isLoaded: true });
		},
		restore: async (db, nowMs = Date.now()) => {
			await adopt(db, await getActivePhase(db), nowMs, true);
		},
		startFocus: async (db, target, nowMs = Date.now()) => {
			if (get().phase) return;
			const sessionId = await startFocusSession(db, {
				startedAt: new Date(nowMs).toISOString(),
				activity: target.activity,
				routineBlockId: target.routineBlockId,
				taskId: target.taskId,
			});
			const phase: ActivePhase = {
				kind: "focus",
				startedAtMs: nowMs,
				durationMs: phaseDurationMs("focus"),
				pausedAtMs: null,
				pausedTotalMs: 0,
				sessionId,
				target,
			};
			await begin(db, phase);
			bestEffort(
				notifyActivePhase(toRow(phase, get().cycleCount), undefined, nowMs),
			);
		},
		pausePhase: async (db, nowMs = Date.now()) => {
			if (!get().phase) return;
			const row = await applyPomodoroAction(db, "pause", nowMs);
			await adopt(db, row, nowMs, false);
			// Sem fase de volta: ela venceu no mesmo instante e foi fechada pela ação.
			if (!row) await refreshStats(db, nowMs);
		},
		resumePhase: async (db, nowMs = Date.now()) => {
			if (!get().phase) return;
			const row = await applyPomodoroAction(db, "resume", nowMs);
			await adopt(db, row, nowMs, false);
			if (!row) await refreshStats(db, nowMs);
		},
		finishPhase: async (db, nowMs = Date.now()) => {
			const phase = get().phase;
			if (!phase || finishing || !isPhaseExpired(phase, nowMs)) return;
			finishing = true;
			try {
				clearTimer();
				if (phase.kind !== "focus") {
					await applyPomodoroAction(db, "stop", nowMs);
					if (phase.kind === "longBreak") set({ cycleCount: 0 });
					set({
						phase: null,
						notice: "Pausa terminada. Pronto para outro foco?",
					});
					bestEffort(settlePomodoroLive("break"));
					return;
				}

				if (phase.sessionId !== null) {
					await finishFocusSession(
						db,
						phase.sessionId,
						new Date(phaseEndsAtMs(phase)).toISOString(),
						true,
						phase.pausedTotalMs,
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
				const nextPhase: ActivePhase = {
					kind: nextKind,
					// A pausa começa quando o foco acabou, mesmo que o app só volte depois.
					startedAtMs: phaseEndsAtMs(phase),
					durationMs: phaseDurationMs(nextKind),
					pausedAtMs: null,
					pausedTotalMs: 0,
					sessionId: null,
					target: phase.target,
				};
				await begin(db, nextPhase);
				bestEffort(settlePomodoroLive("focus"));
				// Se a pausa também já venceu, ela será fechada em seguida: não vale avisar.
				if (!isPhaseExpired(nextPhase, nowMs)) {
					bestEffort(
						notifyActivePhase(toRow(nextPhase, cycleCount), undefined, nowMs),
					);
				}
			} finally {
				finishing = false;
			}
		},
		cancelPhase: async (db, nowMs = Date.now()) => {
			const phase = get().phase;
			if (!phase) return;
			clearTimer();
			set({ phase: null });
			await applyPomodoroAction(db, "stop", nowMs);
			if (phase.kind === "longBreak") set({ cycleCount: 0 });
		},
		skipBreak: async (db, nowMs = Date.now()) => {
			const phase = get().phase;
			if (!phase || phase.kind === "focus") return;
			clearTimer();
			set({
				phase: null,
				...(phase.kind === "longBreak" ? { cycleCount: 0 } : {}),
			});
			await applyPomodoroAction(db, "stop", nowMs);
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
