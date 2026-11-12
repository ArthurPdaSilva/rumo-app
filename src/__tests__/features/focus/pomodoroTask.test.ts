import { migrateDatabase } from "../../../database/client";
import {
	getActivePhase,
	saveActivePhase,
} from "../../../database/repositories/pomodoroRepository";
import { runPomodoroTask } from "../../../features/focus/pomodoroTask";
import { createTestDatabase } from "../../helpers/createTestDatabase";

jest.mock("../../../features/notifications/pomodoroAlerts", () => ({
	schedulePomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	cancelPomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	showPomodoroLive: jest.fn().mockResolvedValue(undefined),
	hidePomodoroLive: jest.fn().mockResolvedValue(undefined),
}));

const T0 = new Date(2026, 10, 4, 14, 0).getTime();
const MIN = 60_000;

async function setup() {
	const raw = createTestDatabase();
	await migrateDatabase(raw);
	await saveActivePhase(raw, {
		kind: "focus",
		startedAtMs: T0,
		durationMs: 25 * MIN,
		sessionId: null,
		activity: null,
		routineBlockId: null,
		taskId: null,
		pausedAtMs: null,
		pausedTotalMs: 0,
		cycleCount: 0,
	});
	const closeAsync = jest.fn().mockResolvedValue(undefined);
	const db = Object.assign(raw, { closeAsync });
	return { db, closeAsync, open: jest.fn().mockResolvedValue(db) };
}

describe("runPomodoroTask", () => {
	test("o toque em Pausar com o app fechado pausa a fase no banco e fecha o banco", async () => {
		const { db, closeAsync, open } = await setup();

		await runPomodoroTask(
			{ actionIdentifier: "pomodoro.pause" },
			open,
			T0 + 5 * MIN,
		);

		expect((await getActivePhase(db))?.pausedAtMs).toBe(T0 + 5 * MIN);
		expect(closeAsync).toHaveBeenCalledTimes(1);
		db.close();
	});

	test("Encerrar limpa a fase", async () => {
		const { db, open } = await setup();

		await runPomodoroTask(
			{ actionIdentifier: "pomodoro.stop" },
			open,
			T0 + MIN,
		);

		expect(await getActivePhase(db)).toBeNull();
		db.close();
	});

	test.each([
		["toque na notificação em si", { actionIdentifier: "expo.default" }],
		["notificação recebida (sem ação)", { data: { dataString: "{}" } }],
		["payload vazio", null],
	])("ignora %s sem nem abrir o banco", async (_name, payload) => {
		const { db, open } = await setup();

		await runPomodoroTask(payload, open, T0);

		expect(open).not.toHaveBeenCalled();
		expect((await getActivePhase(db))?.pausedAtMs).toBeNull();
		db.close();
	});

	test("fecha o banco mesmo se a ação falhar", async () => {
		const { db, closeAsync } = await setup();
		const broken = Object.assign(
			{ ...db },
			{
				getFirstAsync: jest.fn().mockRejectedValue(new Error("falhou")),
				closeAsync,
			},
		);

		await expect(
			runPomodoroTask(
				{ actionIdentifier: "pomodoro.pause" },
				async () => broken as never,
				T0,
			),
		).rejects.toThrow("falhou");
		expect(closeAsync).toHaveBeenCalledTimes(1);
		db.close();
	});
});
