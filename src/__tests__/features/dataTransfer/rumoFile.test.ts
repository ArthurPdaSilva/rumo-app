import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateDatabase } from "../../../database/client";
import {
	InvalidRumoFileError,
	NewerRumoFileError,
	readRumoFile,
} from "../../../features/dataTransfer/rumoFile";
import {
	createTestDatabase,
	openTestRumoFile,
} from "../../helpers/createTestDatabase";

const seedBytes = () =>
	new Uint8Array(
		readFileSync(join(__dirname, "../../../../seed/rumo-seed.db")),
	);

describe("readRumoFile", () => {
	test("lê o rumo-seed.db: rotina, tarefas e metas, sem perfil nem vícios", async () => {
		const data = await readRumoFile(openTestRumoFile, seedBytes());

		expect(data.routineBlocks).toHaveLength(59);
		expect(data.tasks).toHaveLength(80);
		expect(data.weeklyGoals).toHaveLength(16);
		expect(data.addictions).toEqual([]);
		expect(data.profile).toBeNull();
		expect(data.routineBlocks[0]).toMatchObject({
			weekdays: 62,
			startTime: "08:00",
			reminderMinutes: 10,
		});
		expect(data.tasks.filter((task) => task.done)).toHaveLength(1);
	});

	test("lê perfil e preferências de um backup", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await db.runAsync(
			"INSERT INTO profile (id, username, discreet_mode) VALUES (1, 'Arthur', 1)",
		);
		await db.runAsync("UPDATE app_state SET theme_mode = 'dark'");

		const data = await readRumoFile(
			openTestRumoFile,
			await db.serializeAsync(),
		);

		expect(data.profile).toEqual({
			username: "Arthur",
			notificationsEnabled: true,
			dailyMessageTime: "08:30",
			discreetMode: true,
			themeMode: "dark",
			pomodoroOnFocusEnd: "ask",
		});
		db.close();
	});

	test("ignora recaídas de vícios que não estão no arquivo", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await db.execAsync("PRAGMA foreign_keys = OFF");
		await db.runAsync(
			"INSERT INTO addictions (id, name, quit_at, created_at) VALUES (1, 'A', 'x', 'y')",
		);
		await db.runAsync(
			"INSERT INTO relapses (addiction_id, occurred_at) VALUES (1, 'z'), (99, 'z')",
		);

		const data = await readRumoFile(
			openTestRumoFile,
			await db.serializeAsync(),
		);

		expect(data.relapses.map((item) => item.addictionId)).toEqual([1]);
		db.close();
	});

	test("recusa bytes que não são SQLite", async () => {
		await expect(
			readRumoFile(
				openTestRumoFile,
				new TextEncoder().encode("não sou um banco"),
			),
		).rejects.toBeInstanceOf(InvalidRumoFileError);
	});

	test("recusa SQLite que não é do Rumo (user_version 0)", async () => {
		const db = createTestDatabase();
		await db.execAsync("CREATE TABLE outra (id INTEGER)");

		await expect(
			readRumoFile(openTestRumoFile, await db.serializeAsync()),
		).rejects.toBeInstanceOf(InvalidRumoFileError);
		db.close();
	});

	test("recusa arquivo de uma versão mais nova do esquema", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await db.execAsync("PRAGMA user_version = 99");

		await expect(
			readRumoFile(openTestRumoFile, await db.serializeAsync()),
		).rejects.toBeInstanceOf(NewerRumoFileError);
		db.close();
	});
});
