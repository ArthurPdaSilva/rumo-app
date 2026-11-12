import { migrateDatabase } from "../../database/client";
import { MIGRATIONS } from "../../database/migrations";
import { createTestDatabase } from "../helpers/createTestDatabase";

describe("migrateDatabase", () => {
	test("aplica a migration inicial e atualiza user_version", async () => {
		const db = createTestDatabase();

		const version = await migrateDatabase(db);

		expect(version).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
		const row = await db.getFirstAsync<{ user_version: number }>(
			"PRAGMA user_version",
		);
		expect(row?.user_version).toBe(version);
		const tables = await db.getAllAsync<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
		);
		expect(tables.map((table) => table.name)).toEqual(
			expect.arrayContaining([
				"profile",
				"app_state",
				"addictions",
				"relapses",
				"imports",
				"routine_blocks",
				"tasks",
				"weekly_goals",
				"pomodoro_sessions",
			]),
		);
		db.close();
	});

	test("é idempotente e não perde dados ao rodar de novo", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await db.runAsync(
			"INSERT INTO profile (id, username) VALUES (1, 'Arthur')",
		);

		await migrateDatabase(db);

		const row = await db.getFirstAsync<{ username: string }>(
			"SELECT username FROM profile WHERE id = 1",
		);
		expect(row?.username).toBe("Arthur");
		db.close();
	});

	test("aplica só as migrations pendentes, preservando dados antigos", async () => {
		const db = createTestDatabase();
		const v1 = {
			version: 1,
			sql: "CREATE TABLE a (id INTEGER); INSERT INTO a VALUES (7);",
		};
		const v2 = { version: 2, sql: "ALTER TABLE a ADD COLUMN name TEXT;" };
		await migrateDatabase(db, [v1]);

		const version = await migrateDatabase(db, [v1, v2]);

		expect(version).toBe(2);
		const row = await db.getFirstAsync<{ id: number; name: string | null }>(
			"SELECT id, name FROM a",
		);
		expect(row).toEqual({ id: 7, name: null });
		db.close();
	});

	test("desfaz a migration que falha e mantém a versão anterior", async () => {
		const db = createTestDatabase();
		const ok = { version: 1, sql: "CREATE TABLE a (id INTEGER);" };
		const broken = {
			version: 2,
			sql: "CREATE TABLE b (id INTEGER); SELECT * FROM nao_existe;",
		};

		await expect(migrateDatabase(db, [ok, broken])).rejects.toThrow();

		const row = await db.getFirstAsync<{ user_version: number }>(
			"PRAGMA user_version",
		);
		expect(row?.user_version).toBe(1);
		const b = await db.getFirstAsync(
			"SELECT name FROM sqlite_master WHERE name = 'b'",
		);
		expect(b).toBeNull();
		db.close();
	});

	test("cria o estado do app com o Pomodoro perguntando por padrão", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);

		const row = await db.getFirstAsync<{
			pomodoro_on_focus_end: string;
			theme_mode: string;
		}>("SELECT pomodoro_on_focus_end, theme_mode FROM app_state WHERE id = 1");

		expect(row).toEqual({ pomodoro_on_focus_end: "ask", theme_mode: "system" });
		db.close();
	});

	test("migration 2 preserva sessões e preferências existentes", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db, [MIGRATIONS[0]]);
		await db.execAsync(
			`UPDATE app_state SET pomodoro_on_focus_end = 'auto_complete' WHERE id = 1;
			INSERT INTO pomodoro_sessions (started_at, ended_at, kind, activity, completed)
			VALUES ('2026-11-04T10:00:00.000Z', '2026-11-04T10:25:00.000Z', 'focus', 'Música', 1);`,
		);

		const version = await migrateDatabase(db);

		expect(version).toBeGreaterThanOrEqual(2);
		const session = await db.getFirstAsync<{
			activity: string;
			completed: number;
			paused_ms: number;
		}>("SELECT activity, completed, paused_ms FROM pomodoro_sessions");
		expect(session).toEqual({ activity: "Música", completed: 1, paused_ms: 0 });
		const state = await db.getFirstAsync<{ pomodoro_on_focus_end: string }>(
			"SELECT pomodoro_on_focus_end FROM app_state WHERE id = 1",
		);
		expect(state?.pomodoro_on_focus_end).toBe("auto_complete");
		const active = await db.getAllAsync("SELECT * FROM pomodoro_active");
		expect(active).toEqual([]);
		db.close();
	});

	test("migration 3 preserva a preferência existente e começa repetindo toda semana", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db, MIGRATIONS.slice(0, 2));
		await db.execAsync(
			`UPDATE app_state SET theme_mode = 'dark', onboarding_done = 1 WHERE id = 1;
			INSERT INTO routine_blocks (weekdays, start_time, title) VALUES (2, '09:00', 'Concurso');`,
		);

		await migrateDatabase(db);

		const state = await db.getFirstAsync<{
			theme_mode: string;
			onboarding_done: number;
			calendar_id: string | null;
			calendar_recurring: number;
		}>(
			"SELECT theme_mode, onboarding_done, calendar_id, calendar_recurring FROM app_state WHERE id = 1",
		);
		expect(state).toEqual({
			theme_mode: "dark",
			onboarding_done: 1,
			calendar_id: null,
			calendar_recurring: 1,
		});
		const blocks = await db.getAllAsync("SELECT title FROM routine_blocks");
		expect(blocks).toEqual([{ title: "Concurso" }]);
		db.close();
	});
});
