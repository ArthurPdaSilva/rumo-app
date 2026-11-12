import type { Database } from "@/database/client";
import {
	type ActivePhaseRow,
	clearActivePhase,
	finishFocusSession,
	getActivePhase,
	saveActivePhase,
} from "@/database/repositories/pomodoroRepository";
import { getProfile } from "@/database/repositories/profileRepository";
import {
	breakAfterFocus,
	isPhaseExpired,
	phaseDurationMs,
	phaseEndsAtMs,
	phaseMinutes,
	phaseRemainingMs,
} from "@/features/focus/pomodoro";
import {
	cancelPomodoroAlerts,
	hidePomodoroLive,
	schedulePomodoroAlerts,
	showPomodoroLive,
} from "@/features/notifications/pomodoroAlerts";
import { POMODORO_ACTION_IDS } from "@/features/notifications/planner";
import type { Profile } from "@/types";

/**
 * Transições do Pomodoro que só dependem do banco. A notificação fixa dispara
 * estas ações com o app fechado, quando não há tela nem store em memória, então
 * nada aqui pode depender de estado de interface. A store do foco apenas reflete
 * o resultado (ver `restore`).
 */
export type PomodoroAction = "pause" | "resume" | "stop";

const ACTION_BY_IDENTIFIER: Record<string, PomodoroAction> = {
	[POMODORO_ACTION_IDS.pause]: "pause",
	[POMODORO_ACTION_IDS.resume]: "resume",
	[POMODORO_ACTION_IDS.stop]: "stop",
};

/** Traduz o identificador do botão tocado; o toque no corpo da notificação não é ação. */
export function parsePomodoroAction(identifier: string): PomodoroAction | null {
	return ACTION_BY_IDENTIFIER[identifier] ?? null;
}

/**
 * Deixa a notificação fixa e os avisos agendados de acordo com a fase.
 * Pausada, só a notificação fica (com "Retomar"); correndo, os avisos de fim
 * são reagendados para o horário atual.
 */
export async function notifyActivePhase(
	row: ActivePhaseRow,
	profile?: Profile | null,
	nowMs: number = Date.now(),
): Promise<void> {
	const paused = row.pausedAtMs !== null;
	const endsAtMs = phaseEndsAtMs(row);
	// A notificação vem antes dos avisos: ela divide o identificador do aviso de fim.
	await showPomodoroLive(
		{
			kind: row.kind,
			activity: row.activity,
			paused,
			endsAtMs,
			remainingMs: phaseRemainingMs(row, nowMs),
		},
		profile,
	);
	if (paused) {
		await cancelPomodoroAlerts();
		return;
	}
	if (row.kind === "focus") {
		const breakKind = breakAfterFocus(row.cycleCount + 1);
		await schedulePomodoroAlerts(
			{
				focusEndsAt: endsAtMs,
				breakMinutes: phaseMinutes(breakKind),
				breakEndsAt: endsAtMs + phaseDurationMs(breakKind),
			},
			profile,
		);
		return;
	}
	await schedulePomodoroAlerts(
		{ focusEndsAt: null, breakMinutes: 0, breakEndsAt: endsAtMs },
		profile,
	);
}

/** Fase que venceu sem ninguém fechar (o app estava parado): o foco conta como concluído. */
async function settleExpired(db: Database, row: ActivePhaseRow): Promise<void> {
	if (row.kind === "focus" && row.sessionId !== null) {
		await finishFocusSession(
			db,
			row.sessionId,
			new Date(phaseEndsAtMs(row)).toISOString(),
			true,
			row.pausedTotalMs,
		);
	}
	await clearActivePhase(db);
	// Não esconde a notificação: o aviso de fim já a substituiu e é o que a pessoa deve ver.
	await cancelPomodoroAlerts();
}

/**
 * Aplica pausar, retomar ou encerrar sobre a fase ativa do banco e devolve o
 * que restou dela. É idempotente: o mesmo toque pode chegar duas vezes (ação e
 * ouvinte) e pausar uma fase já pausada, por exemplo, não muda nada.
 */
export async function applyPomodoroAction(
	db: Database,
	action: PomodoroAction,
	nowMs: number = Date.now(),
): Promise<ActivePhaseRow | null> {
	const row = await getActivePhase(db);
	if (!row) {
		await hidePomodoroLive();
		return null;
	}
	if (isPhaseExpired(row, nowMs)) {
		await settleExpired(db, row);
		return null;
	}
	const profile = await getProfile(db);

	if (action === "pause") {
		if (row.pausedAtMs !== null) return row;
		const paused = { ...row, pausedAtMs: nowMs };
		await saveActivePhase(db, paused);
		await notifyActivePhase(paused, profile, nowMs);
		return paused;
	}

	if (action === "resume") {
		if (row.pausedAtMs === null) return row;
		const resumed = {
			...row,
			pausedAtMs: null,
			pausedTotalMs: row.pausedTotalMs + (nowMs - row.pausedAtMs),
		};
		await saveActivePhase(db, resumed);
		await notifyActivePhase(resumed, profile, nowMs);
		return resumed;
	}

	// Encerrar: o foco interrompido não conta para as metas.
	if (row.kind === "focus" && row.sessionId !== null) {
		const pausedNow = row.pausedAtMs === null ? 0 : nowMs - row.pausedAtMs;
		await finishFocusSession(
			db,
			row.sessionId,
			new Date(nowMs).toISOString(),
			false,
			row.pausedTotalMs + pausedNow,
		);
	}
	await clearActivePhase(db);
	await cancelPomodoroAlerts();
	await hidePomodoroLive();
	return null;
}
