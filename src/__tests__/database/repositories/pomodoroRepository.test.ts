import { migrateDatabase } from "../../../database/client";
import {
	abandonOpenSessions,
	finishFocusSession,
	getFocusStats,
	getMinutesByActivity,
	getOnFocusEnd,
	setOnFocusEnd,
	startFocusSession,
} from "../../../database/repositories/pomodoroRepository";
import { createTestDatabase } from "../../helpers/createTestDatabase";

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

const from = new Date("2026-11-02T00:00:00.000Z");
const to = new Date("2026-11-09T00:00:00.000Z");

async function session(
	db: Awaited<ReturnType<typeof setup>>,
	startedAt: string,
	minutes: number,
	activity: string | null,
	completed = true,
) {
	const id = await startFocusSession(db, {
		startedAt,
		activity,
		routineBlockId: null,
		taskId: null,
	});
	const end = new Date(new Date(startedAt).getTime() + minutes * 60_000);
	await finishFocusSession(db, id, end.toISOString(), completed);
	return id;
}

describe("pomodoroRepository", () => {
	test("soma só focos concluídos dentro do intervalo", async () => {
		const db = await setup();
		await session(db, "2026-11-03T12:00:00.000Z", 25, "Português");
		await session(db, "2026-11-04T12:00:00.000Z", 25, "Português");
		await session(db, "2026-11-04T13:00:00.000Z", 25, "Música");
		await session(db, "2026-11-04T14:00:00.000Z", 10, "Música", false);
		await session(db, "2026-11-20T12:00:00.000Z", 25, "Português");
		await session(db, "2026-11-05T12:00:00.000Z", 25, null);

		expect(await getFocusStats(db, from, to)).toEqual({
			sessions: 4,
			minutes: 100,
		});
		expect(await getMinutesByActivity(db, from, to)).toEqual({
			Português: 50,
			Música: 25,
		});
		db.close();
	});

	test("sessões abertas são encerradas sem contar tempo", async () => {
		const db = await setup();
		const id = await startFocusSession(db, {
			startedAt: "2026-11-04T12:00:00.000Z",
			activity: "Português",
			routineBlockId: null,
			taskId: null,
		});
		await abandonOpenSessions(db);

		const row = await db.getFirstAsync<{
			ended_at: string;
			completed: number;
		}>("SELECT ended_at, completed FROM pomodoro_sessions WHERE id = ?", id);
		expect(row).toEqual({ ended_at: "2026-11-04T12:00:00.000Z", completed: 0 });
		expect((await getFocusStats(db, from, to)).sessions).toBe(0);
		db.close();
	});

	test("guarda e lê a preferência de fim de foco", async () => {
		const db = await setup();
		expect(await getOnFocusEnd(db)).toBe("ask");
		await setOnFocusEnd(db, "auto_complete");
		expect(await getOnFocusEnd(db)).toBe("auto_complete");
		db.close();
	});
});
