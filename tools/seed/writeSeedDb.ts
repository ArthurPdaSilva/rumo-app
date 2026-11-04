import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "@/database/migrations";
import { DEFAULT_REMINDER_MINUTES } from "@/types";
import type { ParsedMarkdown } from "./types";

/**
 * Cria um `.db` do Rumo (mesmo esquema do app) só com rotina, tarefas e metas
 * semanais. Sem perfil nem vícios: o app o trata como "arquivo de plano".
 */
export function writeSeedDb(path: string, sources: ParsedMarkdown[]): void {
	const db = new DatabaseSync(path);
	try {
		// Um único arquivo, sem -wal/-journal ao lado.
		db.exec("PRAGMA journal_mode = DELETE");
		for (const migration of [...MIGRATIONS].sort(
			(a, b) => a.version - b.version,
		)) {
			db.exec(migration.sql);
			db.exec(`PRAGMA user_version = ${migration.version}`);
		}

		const insertBlock = db.prepare(
			`INSERT INTO routine_blocks (weekdays, start_time, end_time, title, reminder_minutes)
			VALUES (?, ?, ?, ?, ?)`,
		);
		const insertTask = db.prepare(
			"INSERT INTO tasks (section, title, done) VALUES (?, ?, ?)",
		);
		const insertGoal = db.prepare(
			"INSERT INTO weekly_goals (activity, target_minutes, note) VALUES (?, ?, ?)",
		);

		db.exec("BEGIN");
		const goals = new Set<string>();
		for (const source of sources) {
			for (const block of source.routineBlocks) {
				insertBlock.run(
					block.weekdays,
					block.startTime,
					block.endTime,
					block.title,
					DEFAULT_REMINDER_MINUTES,
				);
			}
			for (const task of source.tasks) {
				insertTask.run(task.section, task.title, task.done ? 1 : 0);
			}
			for (const goal of source.weeklyGoals) {
				if (goals.has(goal.activity)) continue;
				goals.add(goal.activity);
				insertGoal.run(goal.activity, goal.targetMinutes, goal.note);
			}
		}
		db.exec("COMMIT");
		db.exec("VACUUM");
	} finally {
		db.close();
	}
}
