import type { Database } from "@/database/client";
import type { PomodoroOnFocusEnd, PomodoroPhaseKind } from "@/types";

export interface FocusSessionInput {
	startedAt: string;
	activity: string | null;
	routineBlockId: number | null;
	taskId: number | null;
}

export interface FocusStats {
	sessions: number;
	minutes: number;
}

export async function startFocusSession(
	db: Database,
	input: FocusSessionInput,
): Promise<number> {
	const result = await db.runAsync(
		`INSERT INTO pomodoro_sessions
			(started_at, kind, routine_block_id, task_id, activity, completed)
		VALUES (?, 'focus', ?, ?, ?, 0)`,
		input.startedAt,
		input.routineBlockId,
		input.taskId,
		input.activity,
	);
	return result.lastInsertRowId;
}

/** `pausedMs` é o tempo parado dentro da sessão, descontado dos minutos de foco. */
export async function finishFocusSession(
	db: Database,
	id: number,
	endedAt: string,
	completed: boolean,
	pausedMs = 0,
): Promise<void> {
	await db.runAsync(
		"UPDATE pomodoro_sessions SET ended_at = ?, completed = ?, paused_ms = ? WHERE id = ?",
		endedAt,
		completed ? 1 : 0,
		pausedMs,
		id,
	);
}

/**
 * Fecha sessões abertas que nenhuma fase em andamento reivindica (resto de uma
 * versão antiga ou de um banco restaurado). Elas terminam no próprio início,
 * ou seja, não contam tempo nenhum. A sessão da fase ativa é preservada.
 */
export async function abandonOpenSessions(db: Database): Promise<void> {
	await db.runAsync(
		`UPDATE pomodoro_sessions SET ended_at = started_at, completed = 0
		WHERE ended_at IS NULL
			AND id NOT IN (SELECT session_id FROM pomodoro_active WHERE session_id IS NOT NULL)`,
	);
}

/** Fase do Pomodoro em andamento, guardada para sobreviver ao app ser encerrado. */
export interface ActivePhaseRow {
	kind: PomodoroPhaseKind;
	startedAtMs: number;
	durationMs: number;
	sessionId: number | null;
	activity: string | null;
	routineBlockId: number | null;
	taskId: number | null;
	pausedAtMs: number | null;
	pausedTotalMs: number;
	cycleCount: number;
}

interface ActivePhaseSqlRow {
	kind: PomodoroPhaseKind;
	started_at_ms: number;
	duration_ms: number;
	session_id: number | null;
	activity: string | null;
	routine_block_id: number | null;
	task_id: number | null;
	paused_at_ms: number | null;
	paused_total_ms: number;
	cycle_count: number;
}

export async function getActivePhase(
	db: Database,
): Promise<ActivePhaseRow | null> {
	const row = await db.getFirstAsync<ActivePhaseSqlRow>(
		`SELECT kind, started_at_ms, duration_ms, session_id, activity, routine_block_id,
			task_id, paused_at_ms, paused_total_ms, cycle_count
		FROM pomodoro_active WHERE id = 1`,
	);
	if (!row) return null;
	return {
		kind: row.kind,
		startedAtMs: row.started_at_ms,
		durationMs: row.duration_ms,
		sessionId: row.session_id,
		activity: row.activity,
		routineBlockId: row.routine_block_id,
		taskId: row.task_id,
		pausedAtMs: row.paused_at_ms,
		pausedTotalMs: row.paused_total_ms,
		cycleCount: row.cycle_count,
	};
}

export async function saveActivePhase(
	db: Database,
	phase: ActivePhaseRow,
): Promise<void> {
	await db.runAsync(
		`INSERT OR REPLACE INTO pomodoro_active
			(id, kind, started_at_ms, duration_ms, session_id, activity, routine_block_id,
			task_id, paused_at_ms, paused_total_ms, cycle_count)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		phase.kind,
		phase.startedAtMs,
		phase.durationMs,
		phase.sessionId,
		phase.activity,
		phase.routineBlockId,
		phase.taskId,
		phase.pausedAtMs,
		phase.pausedTotalMs,
		phase.cycleCount,
	);
}

export async function clearActivePhase(db: Database): Promise<void> {
	await db.runAsync("DELETE FROM pomodoro_active WHERE id = 1");
}

interface SessionRow {
	started_at: string;
	ended_at: string;
	paused_ms: number;
	activity: string | null;
}

async function completedFocusIn(
	db: Database,
	from: Date,
	to: Date,
): Promise<SessionRow[]> {
	return db.getAllAsync<SessionRow>(
		`SELECT started_at, ended_at, paused_ms, activity FROM pomodoro_sessions
		WHERE kind = 'focus' AND completed = 1 AND ended_at IS NOT NULL
			AND started_at >= ? AND started_at < ?`,
		from.toISOString(),
		to.toISOString(),
	);
}

/** Minutos de foco de verdade: o tempo parado em pausa não conta. */
function minutesOf(row: SessionRow): number {
	const ms =
		new Date(row.ended_at).getTime() -
		new Date(row.started_at).getTime() -
		row.paused_ms;
	return Math.max(0, Math.round(ms / 60_000));
}

export async function getFocusStats(
	db: Database,
	from: Date,
	to: Date,
): Promise<FocusStats> {
	const rows = await completedFocusIn(db, from, to);
	return {
		sessions: rows.length,
		minutes: rows.reduce((total, row) => total + minutesOf(row), 0),
	};
}

/** Minutos de foco concluído por atividade no intervalo (sessões sem atividade ficam de fora). */
export async function getMinutesByActivity(
	db: Database,
	from: Date,
	to: Date,
): Promise<Record<string, number>> {
	const totals: Record<string, number> = {};
	for (const row of await completedFocusIn(db, from, to)) {
		if (!row.activity) continue;
		totals[row.activity] = (totals[row.activity] ?? 0) + minutesOf(row);
	}
	return totals;
}

export async function getOnFocusEnd(db: Database): Promise<PomodoroOnFocusEnd> {
	const row = await db.getFirstAsync<{ value: PomodoroOnFocusEnd }>(
		"SELECT pomodoro_on_focus_end AS value FROM app_state WHERE id = 1",
	);
	return row?.value ?? "ask";
}

export async function setOnFocusEnd(
	db: Database,
	value: PomodoroOnFocusEnd,
): Promise<void> {
	await db.runAsync(
		"UPDATE app_state SET pomodoro_on_focus_end = ? WHERE id = 1",
		value,
	);
}
