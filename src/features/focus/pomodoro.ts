import {
	POMODORO_BREAK_MINUTES,
	POMODORO_CYCLES_UNTIL_LONG_BREAK,
	POMODORO_FOCUS_MINUTES,
	POMODORO_LONG_BREAK_MINUTES,
	type PomodoroPhaseKind,
} from "@/types";

export type PhaseKind = PomodoroPhaseKind;

const MINUTE_MS = 60_000;

export const PHASE_LABEL: Record<PhaseKind, string> = {
	focus: "Foco",
	break: "Pausa curta",
	longBreak: "Pausa longa",
};

export function phaseMinutes(kind: PhaseKind): number {
	if (kind === "focus") return POMODORO_FOCUS_MINUTES;
	return kind === "break"
		? POMODORO_BREAK_MINUTES
		: POMODORO_LONG_BREAK_MINUTES;
}

export function phaseDurationMs(kind: PhaseKind): number {
	return phaseMinutes(kind) * MINUTE_MS;
}

/** Pausa que vem depois de um foco, dado quantos focos já foram concluídos no ciclo. */
export function breakAfterFocus(completedInCycle: number): PhaseKind {
	return completedInCycle >= POMODORO_CYCLES_UNTIL_LONG_BREAK
		? "longBreak"
		: "break";
}

/** Relógio "mm:ss"; arredonda para cima para não mostrar 00:00 antes de acabar. */
export function formatClock(remainingMs: number): string {
	const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Tempos de uma fase: o bastante para saber quando ela acaba e quanto falta. */
export interface PhaseTiming {
	startedAtMs: number;
	durationMs: number;
	/** Quando a pausa em curso começou; `null` com a fase correndo. */
	pausedAtMs: number | null;
	/** Soma das pausas já encerradas. */
	pausedTotalMs: number;
}

/** Instante em que a fase acaba se continuar correndo: cada pausa empurra o fim. */
export function phaseEndsAtMs(timing: PhaseTiming): number {
	return timing.startedAtMs + timing.pausedTotalMs + timing.durationMs;
}

/** Tempo que falta; congelado enquanto a fase está pausada. */
export function phaseRemainingMs(timing: PhaseTiming, nowMs: number): number {
	const reference = timing.pausedAtMs ?? nowMs;
	return Math.max(0, phaseEndsAtMs(timing) - reference);
}

/** Uma fase pausada nunca vence sozinha. */
export function isPhaseExpired(timing: PhaseTiming, nowMs: number): boolean {
	return timing.pausedAtMs === null && nowMs >= phaseEndsAtMs(timing);
}
