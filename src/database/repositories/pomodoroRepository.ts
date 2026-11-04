import type { Database } from "@/database/client";
import type { PomodoroOnFocusEnd } from "@/types";

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

export async function finishFocusSession(
	db: Database,
	id: number,
	endedAt: string,
	completed: boolean,
): Promise<void> {
	await db.runAsync(
		"UPDATE pomodoro_sessions SET ended_at = ?, completed = ? WHERE id = ?",
		endedAt,
		completed ? 1 : 0,
		id,
	);
}

/**
 * Fecha sessões que ficaram abertas (o app foi encerrado no meio do foco).
 * Elas terminam no próprio início, ou seja, não contam tempo nenhum.
 */
export async function abandonOpenSessions(db: Database): Promise<void> {
	await db.runAsync(
		"UPDATE pomodoro_sessions SET ended_at = started_at, completed = 0 WHERE ended_at IS NULL",
	);
}

interface SessionRow {
	started_at: string;
	ended_at: string;
	activity: string | null;
}

async function completedFocusIn(
	db: Database,
	from: Date,
	to: Date,
): Promise<SessionRow[]> {
	return db.getAllAsync<SessionRow>(
		`SELECT started_at, ended_at, activity FROM pomodoro_sessions
		WHERE kind = 'focus' AND completed = 1 AND ended_at IS NOT NULL
			AND started_at >= ? AND started_at < ?`,
		from.toISOString(),
		to.toISOString(),
	);
}

function minutesOf(row: SessionRow): number {
	const ms =
		new Date(row.ended_at).getTime() - new Date(row.started_at).getTime();
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
