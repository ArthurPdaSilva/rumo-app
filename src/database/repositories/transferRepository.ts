import type { Database } from "@/database/client";
import type {
	PreviewLine,
	RumoFileData,
	TransferCategory,
	TransferPreview,
} from "@/features/dataTransfer/types";

export type CurrentCounts = Record<TransferCategory, number>;

const LABELS: Record<TransferCategory, string> = {
	routineBlocks: "Blocos de rotina",
	tasks: "Tarefas",
	weeklyGoals: "Metas semanais",
	addictions: "Vícios",
	relapses: "Recaídas",
	pomodoroSessions: "Sessões de foco",
	profile: "Perfil e preferências",
};

const ORDER: TransferCategory[] = [
	"profile",
	"addictions",
	"relapses",
	"routineBlocks",
	"tasks",
	"weeklyGoals",
	"pomodoroSessions",
];

export async function getCurrentCounts(db: Database): Promise<CurrentCounts> {
	const row = await db.getFirstAsync<Record<string, number>>(`SELECT
		(SELECT COUNT(*) FROM routine_blocks) AS routineBlocks,
		(SELECT COUNT(*) FROM tasks) AS tasks,
		(SELECT COUNT(*) FROM weekly_goals) AS weeklyGoals,
		(SELECT COUNT(*) FROM addictions) AS addictions,
		(SELECT COUNT(*) FROM relapses) AS relapses,
		(SELECT COUNT(*) FROM pomodoro_sessions) AS pomodoroSessions,
		(SELECT COUNT(*) FROM profile WHERE TRIM(username) <> '') AS profile`);
	return {
		routineBlocks: row?.routineBlocks ?? 0,
		tasks: row?.tasks ?? 0,
		weeklyGoals: row?.weeklyGoals ?? 0,
		addictions: row?.addictions ?? 0,
		relapses: row?.relapses ?? 0,
		pomodoroSessions: row?.pomodoroSessions ?? 0,
		profile: row?.profile ?? 0,
	};
}

export function incomingCounts(data: RumoFileData): CurrentCounts {
	return {
		routineBlocks: data.routineBlocks.length,
		tasks: data.tasks.length,
		weeklyGoals: data.weeklyGoals.length,
		addictions: data.addictions.length,
		relapses: data.relapses.length,
		pomodoroSessions: data.pomodoroSessions.length,
		profile: data.profile ? 1 : 0,
	};
}

/** Backup completo = o arquivo traz vícios ou perfil: vira cópia exata. */
export function isFullBackup(data: RumoFileData): boolean {
	return data.addictions.length > 0 || data.profile !== null;
}

function taskKey(task: { section: string; title: string }): string {
	return `${task.section}\u0000${task.title}`;
}

async function doneTaskKeys(db: Database): Promise<Set<string>> {
	const rows = await db.getAllAsync<{ section: string; title: string }>(
		"SELECT section, title FROM tasks WHERE done = 1",
	);
	return new Set(rows.map(taskKey));
}

/** Mostra o que a importação mudaria, sem alterar nada. */
export async function buildPreview(
	db: Database,
	fileName: string,
	data: RumoFileData,
): Promise<TransferPreview> {
	const current = await getCurrentCounts(db);
	const incoming = incomingCounts(data);
	const lines: PreviewLine[] = ORDER.filter(
		(category) => incoming[category] > 0,
	).map((category) => ({
		category,
		label: LABELS[category],
		incoming: incoming[category],
		current: current[category],
	}));

	const full = isFullBackup(data);
	const previouslyDone = full ? new Set<string>() : await doneTaskKeys(db);
	return {
		fileName,
		lines,
		isFullBackup: full,
		replacesExistingData: lines.some((line) => line.current > 0),
		keptDone: data.tasks.filter((task) => previouslyDone.has(taskKey(task)))
			.length,
	};
}

/**
 * Aplica o arquivo numa transação. Cada categoria que o arquivo traz
 * substitui a atual; categorias ausentes ficam como estão. Em arquivos de
 * plano (sem vícios nem perfil), tarefas já concluídas continuam concluídas.
 */
export async function applyRumoData(
	db: Database,
	data: RumoFileData,
): Promise<void> {
	const full = isFullBackup(data);

	await db.withTransactionAsync(async () => {
		const previouslyDone = full ? new Set<string>() : await doneTaskKeys(db);

		if (data.profile) {
			const p = data.profile;
			await db.runAsync(
				`INSERT OR REPLACE INTO profile
					(id, username, notifications_enabled, daily_message_time, discreet_mode)
				VALUES (1, ?, ?, ?, ?)`,
				p.username,
				p.notificationsEnabled ? 1 : 0,
				p.dailyMessageTime,
				p.discreetMode ? 1 : 0,
			);
			await db.runAsync(
				"UPDATE app_state SET theme_mode = ?, pomodoro_on_focus_end = ?, onboarding_done = 1 WHERE id = 1",
				p.themeMode,
				p.pomodoroOnFocusEnd,
			);
		}

		if (data.addictions.length > 0) {
			await db.runAsync("DELETE FROM addictions");
			for (const item of data.addictions) {
				await db.runAsync(
					"INSERT INTO addictions (id, name, icon, quit_at, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?)",
					item.id,
					item.name,
					item.icon,
					item.quitAt,
					item.createdAt,
					item.archivedAt,
				);
			}
			for (const relapse of data.relapses) {
				await db.runAsync(
					"INSERT INTO relapses (id, addiction_id, occurred_at, note) VALUES (?, ?, ?, ?)",
					relapse.id,
					relapse.addictionId,
					relapse.occurredAt,
					relapse.note,
				);
			}
		}

		if (data.routineBlocks.length > 0) {
			await db.runAsync("DELETE FROM routine_blocks");
			for (const block of data.routineBlocks) {
				await db.runAsync(
					`INSERT INTO routine_blocks
						(id, weekdays, start_time, end_time, title, notes, reminder_minutes)
					VALUES (?, ?, ?, ?, ?, ?, ?)`,
					block.id,
					block.weekdays,
					block.startTime,
					block.endTime,
					block.title,
					block.notes,
					block.reminderMinutes,
				);
			}
		}

		if (data.tasks.length > 0) {
			await db.runAsync("DELETE FROM tasks");
			for (const task of data.tasks) {
				await db.runAsync(
					"INSERT INTO tasks (id, section, title, done) VALUES (?, ?, ?, ?)",
					task.id,
					task.section,
					task.title,
					task.done || previouslyDone.has(taskKey(task)) ? 1 : 0,
				);
			}
		}

		if (data.weeklyGoals.length > 0) {
			await db.runAsync("DELETE FROM weekly_goals");
			for (const goal of data.weeklyGoals) {
				await db.runAsync(
					"INSERT INTO weekly_goals (activity, target_minutes, note) VALUES (?, ?, ?)",
					goal.activity,
					goal.targetMinutes,
					goal.note,
				);
			}
		}

		if (data.pomodoroSessions.length > 0) {
			await db.runAsync("DELETE FROM pomodoro_sessions");
			for (const session of data.pomodoroSessions) {
				await db.runAsync(
					`INSERT INTO pomodoro_sessions
						(id, started_at, ended_at, kind, routine_block_id, task_id, activity, completed)
					VALUES (?, ?, ?, ?,
						(SELECT id FROM routine_blocks WHERE id = ?),
						(SELECT id FROM tasks WHERE id = ?),
						?, ?)`,
					session.id,
					session.startedAt,
					session.endedAt,
					session.kind,
					session.routineBlockId,
					session.taskId,
					session.activity,
					session.completed ? 1 : 0,
				);
			}
		}
	});
}

/** Bytes do `rumo.db` atual: é o próprio arquivo de backup. */
export async function exportBackupBytes(db: Database): Promise<Uint8Array> {
	return db.serializeAsync();
}
