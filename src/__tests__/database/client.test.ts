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
});
