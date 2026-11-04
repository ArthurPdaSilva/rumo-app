import { migrateDatabase } from "../../../database/client";
import {
	applyRumoData,
	buildPreview,
	exportBackupBytes,
	getCurrentCounts,
} from "../../../database/repositories/transferRepository";
import { readRumoFile } from "../../../features/dataTransfer/rumoFile";
import type { RumoFileData } from "../../../features/dataTransfer/types";
import {
	createTestDatabase,
	openTestRumoFile,
} from "../../helpers/createTestDatabase";

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

const plan: RumoFileData = {
	routineBlocks: [
		{
			id: 1,
			weekdays: 62,
			startTime: "09:40",
			endTime: "10:40",
			title: "Concurso 1",
			notes: null,
			reminderMinutes: 10,
		},
	],
	tasks: [
		{ id: 1, section: "Português", title: "Classes", done: false },
		{ id: 2, section: "Português", title: "Verbos", done: false },
	],
	weeklyGoals: [{ activity: "Inglês", targetMinutes: 360, note: null }],
	addictions: [],
	relapses: [],
	pomodoroSessions: [],
	profile: null,
};

describe("transferRepository", () => {
	test("arquivo de plano preenche rotina, tarefas e metas e não toca em vícios nem perfil", async () => {
		const db = await setup();
		await db.runAsync(
			"INSERT INTO profile (id, username) VALUES (1, 'Arthur')",
		);
		await db.runAsync(
			"INSERT INTO addictions (name, quit_at, created_at) VALUES ('Cigarro', 'a', 'b')",
		);

		await applyRumoData(db, plan);

		expect(await getCurrentCounts(db)).toEqual({
			routineBlocks: 1,
			tasks: 2,
			weeklyGoals: 1,
			addictions: 1,
			relapses: 0,
			pomodoroSessions: 0,
			profile: 1,
		});
		db.close();
	});

	test("reimportar um plano substitui os dados e mantém tarefas concluídas", async () => {
		const db = await setup();
		await applyRumoData(db, plan);
		await db.runAsync("UPDATE tasks SET done = 1 WHERE title = 'Classes'");

		const preview = await buildPreview(db, "plano.db", plan);
		await applyRumoData(db, plan);

		expect(preview.keptDone).toBe(1);
		expect(preview.replacesExistingData).toBe(true);
		expect(preview.isFullBackup).toBe(false);
		const done = await db.getAllAsync<{ title: string; done: number }>(
			"SELECT title, done FROM tasks ORDER BY id",
		);
		expect(done).toEqual([
			{ title: "Classes", done: 1 },
			{ title: "Verbos", done: 0 },
		]);
		expect((await getCurrentCounts(db)).routineBlocks).toBe(1);
		db.close();
	});

	test("preview não altera nada e lista só o que o arquivo traz", async () => {
		const db = await setup();

		const preview = await buildPreview(db, "plano.db", plan);

		expect(
			preview.lines.map((line) => [line.category, line.incoming, line.current]),
		).toEqual([
			["routineBlocks", 1, 0],
			["tasks", 2, 0],
			["weeklyGoals", 1, 0],
		]);
		expect(preview.replacesExistingData).toBe(false);
		expect((await getCurrentCounts(db)).tasks).toBe(0);
		db.close();
	});

	test("backup completo: exportar e importar em outro aparelho gera cópia exata", async () => {
		const source = await setup();
		await source.runAsync(
			"INSERT INTO profile (id, username, daily_message_time) VALUES (1, 'Arthur', '07:15')",
		);
		await source.runAsync(
			"UPDATE app_state SET theme_mode = 'dark', pomodoro_on_focus_end = 'auto_complete'",
		);
		await source.runAsync(
			"INSERT INTO addictions (id, name, icon, quit_at, created_at) VALUES (7, 'Cigarro', 'smoking', '2026-10-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z')",
		);
		await source.runAsync(
			"INSERT INTO relapses (addiction_id, occurred_at, note) VALUES (7, '2026-10-10T10:00:00.000Z', 'estresse')",
		);
		await applyRumoData(source, plan);
		await source.runAsync("UPDATE tasks SET done = 1 WHERE id = 2");
		await source.runAsync(
			"INSERT INTO pomodoro_sessions (started_at, kind, routine_block_id, task_id, completed) VALUES ('2026-11-04T10:00:00.000Z', 'focus', 1, 2, 1)",
		);
		const backup = await readRumoFile(
			openTestRumoFile,
			await exportBackupBytes(source),
		);

		const target = await setup();
		await target.runAsync(
			"INSERT INTO tasks (section, title, done) VALUES ('Antiga', 'Lixo', 1)",
		);
		const preview = await buildPreview(target, "backup.db", backup);
		await applyRumoData(target, backup);

		expect(preview.isFullBackup).toBe(true);
		expect(await getCurrentCounts(target)).toEqual(
			await getCurrentCounts(source),
		);
		const again = await readRumoFile(
			openTestRumoFile,
			await exportBackupBytes(target),
		);
		expect(again).toEqual(backup);
		const state = await target.getFirstAsync<{
			theme_mode: string;
			onboarding_done: number;
		}>("SELECT theme_mode, onboarding_done FROM app_state");
		expect(state).toEqual({ theme_mode: "dark", onboarding_done: 1 });
		source.close();
		target.close();
	});

	test("backup completo não herda o estado das tarefas do aparelho atual", async () => {
		const db = await setup();
		await applyRumoData(db, plan);
		await db.runAsync("UPDATE tasks SET done = 1");
		const full: RumoFileData = {
			...plan,
			profile: {
				username: "Arthur",
				notificationsEnabled: true,
				dailyMessageTime: "08:30",
				discreetMode: false,
				themeMode: "system",
				pomodoroOnFocusEnd: "ask",
			},
		};

		await applyRumoData(db, full);

		const done = await db.getAllAsync<{ done: number }>(
			"SELECT done FROM tasks",
		);
		expect(done.map((row) => row.done)).toEqual([0, 0]);
		db.close();
	});

	test("sessões apontando para itens que não existem ficam sem vínculo", async () => {
		const db = await setup();
		const onlySessions: RumoFileData = {
			...plan,
			routineBlocks: [],
			tasks: [],
			weeklyGoals: [],
			pomodoroSessions: [
				{
					id: 1,
					startedAt: "a",
					endedAt: null,
					kind: "focus",
					routineBlockId: 5,
					taskId: 9,
					activity: "x",
					completed: false,
				},
			],
		};

		await applyRumoData(db, onlySessions);

		const row = await db.getFirstAsync<{
			routine_block_id: number | null;
			task_id: number | null;
		}>("SELECT routine_block_id, task_id FROM pomodoro_sessions");
		expect(row).toEqual({ routine_block_id: null, task_id: null });
		db.close();
	});

	test("desfaz tudo se algo falhar no meio", async () => {
		const db = await setup();
		await applyRumoData(db, plan);
		const broken: RumoFileData = {
			...plan,
			tasks: [
				{ id: 1, section: "A", title: null as unknown as string, done: false },
			],
		};

		await expect(applyRumoData(db, broken)).rejects.toThrow();

		expect((await getCurrentCounts(db)).tasks).toBe(2);
		db.close();
	});
});
