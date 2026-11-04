import {
	type Database,
	migrateDatabase,
	type TemporaryDatabase,
} from "@/database/client";
import { MIGRATIONS } from "@/database/migrations";
import type {
	FileAddiction,
	FilePomodoroSession,
	FileProfile,
	FileRelapse,
	FileRoutineBlock,
	FileTask,
	FileWeeklyGoal,
	RumoFileData,
} from "@/features/dataTransfer/types";
import { DEFAULT_REMINDER_MINUTES } from "@/types";

/** Abre os bytes de um `.db` como banco temporário (no app: `deserializeDatabaseAsync`). */
export type OpenRumoFile = (bytes: Uint8Array) => Promise<TemporaryDatabase>;

export class InvalidRumoFileError extends Error {
	constructor() {
		super("Arquivo não é um .db do Rumo");
	}
}

export class NewerRumoFileError extends Error {
	constructor() {
		super("Arquivo criado por uma versão mais nova do app");
	}
}

const LATEST_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

async function readUserVersion(db: Database): Promise<number> {
	const row = await db.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);
	return row?.user_version ?? 0;
}

/**
 * Lê um `.db` do Rumo (backup ou arquivo de plano). Arquivos de versões antigas
 * do esquema são atualizados no banco temporário antes da leitura.
 */
export async function readRumoFile(
	open: OpenRumoFile,
	bytes: Uint8Array,
): Promise<RumoFileData> {
	let db: TemporaryDatabase;
	try {
		db = await open(bytes);
	} catch {
		throw new InvalidRumoFileError();
	}

	try {
		let version: number;
		try {
			version = await readUserVersion(db);
		} catch {
			throw new InvalidRumoFileError();
		}
		if (version < 1) throw new InvalidRumoFileError();
		if (version > LATEST_VERSION) throw new NewerRumoFileError();
		await migrateDatabase(db);
		return await readAll(db);
	} finally {
		await db.closeAsync().catch(() => undefined);
	}
}

async function readAll(db: Database): Promise<RumoFileData> {
	const blocks = await db.getAllAsync<{
		id: number;
		weekdays: number;
		start_time: string;
		end_time: string | null;
		title: string;
		notes: string | null;
		reminder_minutes: number | null;
	}>(
		"SELECT id, weekdays, start_time, end_time, title, notes, reminder_minutes FROM routine_blocks ORDER BY id",
	);
	const tasks = await db.getAllAsync<{
		id: number;
		section: string;
		title: string;
		done: number;
	}>("SELECT id, section, title, done FROM tasks ORDER BY id");
	const goals = await db.getAllAsync<{
		activity: string;
		target_minutes: number;
		note: string | null;
	}>("SELECT activity, target_minutes, note FROM weekly_goals ORDER BY id");
	const addictions = await db.getAllAsync<{
		id: number;
		name: string;
		icon: string;
		quit_at: string;
		created_at: string;
		archived_at: string | null;
	}>(
		"SELECT id, name, icon, quit_at, created_at, archived_at FROM addictions ORDER BY id",
	);
	const relapses = await db.getAllAsync<{
		id: number;
		addiction_id: number;
		occurred_at: string;
		note: string | null;
	}>("SELECT id, addiction_id, occurred_at, note FROM relapses ORDER BY id");
	const sessions = await db.getAllAsync<{
		id: number;
		started_at: string;
		ended_at: string | null;
		kind: "focus" | "break";
		routine_block_id: number | null;
		task_id: number | null;
		activity: string | null;
		completed: number;
	}>(
		"SELECT id, started_at, ended_at, kind, routine_block_id, task_id, activity, completed FROM pomodoro_sessions ORDER BY id",
	);
	const profileRow = await db.getFirstAsync<{
		username: string;
		notifications_enabled: number;
		daily_message_time: string;
		discreet_mode: number;
	}>(
		"SELECT username, notifications_enabled, daily_message_time, discreet_mode FROM profile WHERE id = 1",
	);
	const state = await db.getFirstAsync<{
		theme_mode: FileProfile["themeMode"];
		pomodoro_on_focus_end: FileProfile["pomodoroOnFocusEnd"];
	}>("SELECT theme_mode, pomodoro_on_focus_end FROM app_state WHERE id = 1");

	const addictionIds = new Set(addictions.map((row) => row.id));

	return {
		routineBlocks: blocks.map(
			(row): FileRoutineBlock => ({
				id: row.id,
				weekdays: row.weekdays,
				startTime: row.start_time,
				endTime: row.end_time,
				title: row.title,
				notes: row.notes,
				reminderMinutes: row.reminder_minutes ?? DEFAULT_REMINDER_MINUTES,
			}),
		),
		tasks: tasks.map(
			(row): FileTask => ({
				id: row.id,
				section: row.section,
				title: row.title,
				done: row.done === 1,
			}),
		),
		weeklyGoals: goals.map(
			(row): FileWeeklyGoal => ({
				activity: row.activity,
				targetMinutes: row.target_minutes,
				note: row.note,
			}),
		),
		addictions: addictions.map(
			(row): FileAddiction => ({
				id: row.id,
				name: row.name,
				icon: row.icon,
				quitAt: row.quit_at,
				createdAt: row.created_at,
				archivedAt: row.archived_at,
			}),
		),
		relapses: relapses
			.filter((row) => addictionIds.has(row.addiction_id))
			.map(
				(row): FileRelapse => ({
					id: row.id,
					addictionId: row.addiction_id,
					occurredAt: row.occurred_at,
					note: row.note,
				}),
			),
		pomodoroSessions: sessions.map(
			(row): FilePomodoroSession => ({
				id: row.id,
				startedAt: row.started_at,
				endedAt: row.ended_at,
				kind: row.kind,
				routineBlockId: row.routine_block_id,
				taskId: row.task_id,
				activity: row.activity,
				completed: row.completed === 1,
			}),
		),
		profile:
			profileRow && profileRow.username.trim() !== ""
				? {
						username: profileRow.username,
						notificationsEnabled: profileRow.notifications_enabled === 1,
						dailyMessageTime: profileRow.daily_message_time,
						discreetMode: profileRow.discreet_mode === 1,
						themeMode: state?.theme_mode ?? "system",
						pomodoroOnFocusEnd: state?.pomodoro_on_focus_end ?? "ask",
					}
				: null,
	};
}
