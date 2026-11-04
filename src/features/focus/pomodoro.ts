import {
	POMODORO_BREAK_MINUTES,
	POMODORO_CYCLES_UNTIL_LONG_BREAK,
	POMODORO_FOCUS_MINUTES,
	POMODORO_LONG_BREAK_MINUTES,
} from "@/types";

export type PhaseKind = "focus" | "break" | "longBreak";

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
