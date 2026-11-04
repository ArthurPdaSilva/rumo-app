import type { Database } from "@/database/client";
import type { RoutineBlock, Task, WeeklyGoal } from "@/types";

interface BlockRow {
	id: number;
	weekdays: number;
	start_time: string;
	end_time: string | null;
	title: string;
	notes: string | null;
	reminder_minutes: number;
	import_id: number | null;
}

function toBlock(row: BlockRow): RoutineBlock {
	return {
		id: row.id,
		weekdays: row.weekdays,
		startTime: row.start_time,
		endTime: row.end_time,
		title: row.title,
		notes: row.notes,
		reminderMinutes: row.reminder_minutes,
		importId: row.import_id,
	};
}

export type BlockInput = Pick<
	RoutineBlock,
	"weekdays" | "startTime" | "endTime" | "title" | "notes" | "reminderMinutes"
>;

export async function listBlocks(db: Database): Promise<RoutineBlock[]> {
	const rows = await db.getAllAsync<BlockRow>(
		`SELECT id, weekdays, start_time, end_time, title, notes, reminder_minutes, import_id
		FROM routine_blocks ORDER BY start_time, id`,
	);
	return rows.map(toBlock);
}

export async function createBlock(
	db: Database,
	input: BlockInput,
): Promise<number> {
	const result = await db.runAsync(
		`INSERT INTO routine_blocks
			(weekdays, start_time, end_time, title, notes, reminder_minutes)
		VALUES (?, ?, ?, ?, ?, ?)`,
		input.weekdays,
		input.startTime,
		input.endTime,
		input.title,
		input.notes,
		input.reminderMinutes,
	);
	return result.lastInsertRowId;
}

export async function updateBlock(
	db: Database,
	id: number,
	input: BlockInput,
): Promise<void> {
	await db.runAsync(
		`UPDATE routine_blocks
		SET weekdays = ?, start_time = ?, end_time = ?, title = ?, notes = ?, reminder_minutes = ?
		WHERE id = ?`,
		input.weekdays,
		input.startTime,
		input.endTime,
		input.title,
		input.notes,
		input.reminderMinutes,
		id,
	);
}

export async function deleteBlock(db: Database, id: number): Promise<void> {
	await db.runAsync("DELETE FROM routine_blocks WHERE id = ?", id);
}

export async function listTasks(db: Database): Promise<Task[]> {
	const rows = await db.getAllAsync<{
		id: number;
		section: string;
		title: string;
		done: number;
		import_id: number | null;
	}>("SELECT id, section, title, done, import_id FROM tasks ORDER BY id");
	return rows.map((row) => ({
		id: row.id,
		section: row.section,
		title: row.title,
		done: row.done === 1,
		importId: row.import_id,
	}));
}

export async function setTaskDone(
	db: Database,
	id: number,
	done: boolean,
): Promise<void> {
	await db.runAsync("UPDATE tasks SET done = ? WHERE id = ?", done ? 1 : 0, id);
}

export async function listGoals(db: Database): Promise<WeeklyGoal[]> {
	const rows = await db.getAllAsync<{
		id: number;
		activity: string;
		target_minutes: number;
		note: string | null;
		import_id: number | null;
	}>(
		"SELECT id, activity, target_minutes, note, import_id FROM weekly_goals ORDER BY id",
	);
	return rows.map((row) => ({
		id: row.id,
		activity: row.activity,
		targetMinutes: row.target_minutes,
		note: row.note,
		importId: row.import_id,
	}));
}
