import { migrateDatabase } from "../../../database/client";
import {
	type ActivePhaseRow,
	getActivePhase,
	getFocusStats,
	saveActivePhase,
	startFocusSession,
} from "../../../database/repositories/pomodoroRepository";
import {
	applyPomodoroAction,
	notifyActivePhase,
	parsePomodoroAction,
} from "../../../features/focus/pomodoroActions";
import {
	cancelPomodoroAlerts,
	hidePomodoroLive,
	schedulePomodoroAlerts,
	showPomodoroLive,
} from "../../../features/notifications/pomodoroAlerts";
import { createTestDatabase } from "../../helpers/createTestDatabase";

jest.mock("../../../features/notifications/pomodoroAlerts", () => ({
	schedulePomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	cancelPomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	showPomodoroLive: jest.fn().mockResolvedValue(undefined),
	hidePomodoroLive: jest.fn().mockResolvedValue(undefined),
}));

const MIN = 60_000;
const T0 = new Date(2026, 10, 4, 14, 0).getTime();
const from = new Date(2026, 10, 1);
const to = new Date(2026, 10, 30);

type Db = ReturnType<typeof createTestDatabase>;
let db: Db;

async function startedFocus(overrides: Partial<ActivePhaseRow> = {}) {
	const sessionId = await startFocusSession(db, {
		startedAt: new Date(T0).toISOString(),
		activity: "Português",
		routineBlockId: null,
		taskId: null,
	});
	const row: ActivePhaseRow = {
		kind: "focus",
		startedAtMs: T0,
		durationMs: 25 * MIN,
		sessionId,
		activity: "Português",
		routineBlockId: null,
		taskId: null,
		pausedAtMs: null,
		pausedTotalMs: 0,
		cycleCount: 0,
		...overrides,
	};
	await saveActivePhase(db, row);
	return row;
}

describe("pomodoroActions", () => {
	beforeEach(async () => {
		db = createTestDatabase();
		await migrateDatabase(db);
		jest.clearAllMocks();
	});
	afterEach(() => db.close());

	test("reconhece só os botões do Pomodoro", () => {
		expect(parsePomodoroAction("pomodoro.pause")).toBe("pause");
		expect(parsePomodoroAction("pomodoro.resume")).toBe("resume");
		expect(parsePomodoroAction("pomodoro.stop")).toBe("stop");
		// Tocar na notificação em si não é um botão.
		expect(
			parsePomodoroAction("expo.modules.notifications.actions.DEFAULT"),
		).toBeNull();
	});

	describe("pausar", () => {
		test("congela a fase, cancela os avisos e troca a notificação para Retomar", async () => {
			await startedFocus();

			const result = await applyPomodoroAction(db, "pause", T0 + 10 * MIN);

			expect(result).toMatchObject({ pausedAtMs: T0 + 10 * MIN });
			expect((await getActivePhase(db))?.pausedAtMs).toBe(T0 + 10 * MIN);
			expect(showPomodoroLive).toHaveBeenCalledWith(
				expect.objectContaining({
					paused: true,
					remainingMs: 15 * MIN,
					activity: "Português",
				}),
				null,
			);
			expect(cancelPomodoroAlerts).toHaveBeenCalled();
			expect(schedulePomodoroAlerts).not.toHaveBeenCalled();
		});

		test("é idempotente: o segundo toque não muda a hora da pausa", async () => {
			await startedFocus();
			await applyPomodoroAction(db, "pause", T0 + 10 * MIN);
			jest.clearAllMocks();

			await applyPomodoroAction(db, "pause", T0 + 20 * MIN);

			expect((await getActivePhase(db))?.pausedAtMs).toBe(T0 + 10 * MIN);
			expect(showPomodoroLive).not.toHaveBeenCalled();
		});
	});

	describe("retomar", () => {
		test("soma o tempo parado ao fim da fase e reagenda os avisos para o novo horário", async () => {
			await startedFocus();
			await applyPomodoroAction(db, "pause", T0 + 10 * MIN);
			jest.clearAllMocks();

			const result = await applyPomodoroAction(db, "resume", T0 + 40 * MIN);

			expect(result).toMatchObject({
				pausedAtMs: null,
				pausedTotalMs: 30 * MIN,
			});
			// 25 min de foco + 30 min parado: termina às 14:55.
			expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
				{
					focusEndsAt: T0 + 55 * MIN,
					breakMinutes: 5,
					breakEndsAt: T0 + 60 * MIN,
				},
				null,
			);
			expect(showPomodoroLive).toHaveBeenCalledWith(
				expect.objectContaining({ paused: false, endsAtMs: T0 + 55 * MIN }),
				null,
			);
		});

		test("com a fase correndo não faz nada (toque repetido)", async () => {
			const row = await startedFocus();

			const result = await applyPomodoroAction(db, "resume", T0 + 5 * MIN);

			expect(result).toEqual(row);
			expect(showPomodoroLive).not.toHaveBeenCalled();
		});

		test("pausas seguidas se acumulam", async () => {
			await startedFocus();
			await applyPomodoroAction(db, "pause", T0 + 5 * MIN);
			await applyPomodoroAction(db, "resume", T0 + 15 * MIN);
			await applyPomodoroAction(db, "pause", T0 + 20 * MIN);
			const result = await applyPomodoroAction(db, "resume", T0 + 25 * MIN);

			expect(result?.pausedTotalMs).toBe(15 * MIN);
		});

		test("retomar uma pausa (de descanso) agenda só o fim dela", async () => {
			await saveActivePhase(db, {
				kind: "break",
				startedAtMs: T0,
				durationMs: 5 * MIN,
				sessionId: null,
				activity: null,
				routineBlockId: null,
				taskId: null,
				pausedAtMs: T0 + MIN,
				pausedTotalMs: 0,
				cycleCount: 1,
			});

			await applyPomodoroAction(db, "resume", T0 + 3 * MIN);

			expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
				{ focusEndsAt: null, breakMinutes: 0, breakEndsAt: T0 + 7 * MIN },
				null,
			);
		});
	});

	describe("encerrar", () => {
		test("fecha a sessão sem contar para as metas e limpa avisos e notificação", async () => {
			const row = await startedFocus();

			const result = await applyPomodoroAction(db, "stop", T0 + 10 * MIN);

			expect(result).toBeNull();
			expect(await getActivePhase(db)).toBeNull();
			const session = await db.getFirstAsync<{
				completed: number;
				ended_at: string;
			}>(
				"SELECT completed, ended_at FROM pomodoro_sessions WHERE id = ?",
				row.sessionId,
			);
			expect(session).toEqual({
				completed: 0,
				ended_at: new Date(T0 + 10 * MIN).toISOString(),
			});
			expect(await getFocusStats(db, from, to)).toEqual({
				sessions: 0,
				minutes: 0,
			});
			expect(cancelPomodoroAlerts).toHaveBeenCalled();
			expect(hidePomodoroLive).toHaveBeenCalled();
		});

		test("encerrar enquanto pausado registra o tempo parado até aquele instante", async () => {
			const row = await startedFocus({ pausedAtMs: T0 + 10 * MIN });

			await applyPomodoroAction(db, "stop", T0 + 30 * MIN);

			const session = await db.getFirstAsync<{ paused_ms: number }>(
				"SELECT paused_ms FROM pomodoro_sessions WHERE id = ?",
				row.sessionId,
			);
			expect(session?.paused_ms).toBe(20 * MIN);
		});

		test("sem fase ativa só garante que a notificação saia", async () => {
			const result = await applyPomodoroAction(db, "stop", T0);

			expect(result).toBeNull();
			expect(hidePomodoroLive).toHaveBeenCalled();
		});
	});

	describe("fase que já venceu", () => {
		test("qualquer toque tardio conta o foco como concluído, nos minutos certos", async () => {
			const row = await startedFocus({ pausedTotalMs: 10 * MIN });

			// 25 min de foco + 10 parado = acabou às 14:35; o toque veio às 15:10.
			const result = await applyPomodoroAction(db, "pause", T0 + 70 * MIN);

			expect(result).toBeNull();
			expect(await getActivePhase(db)).toBeNull();
			const session = await db.getFirstAsync<{
				completed: number;
				ended_at: string;
			}>(
				"SELECT completed, ended_at FROM pomodoro_sessions WHERE id = ?",
				row.sessionId,
			);
			expect(session).toEqual({
				completed: 1,
				ended_at: new Date(T0 + 35 * MIN).toISOString(),
			});
			expect(await getFocusStats(db, from, to)).toEqual({
				sessions: 1,
				minutes: 25,
			});
		});

		test("não apaga a notificação: o aviso de fim é o que a pessoa deve ver", async () => {
			await startedFocus();

			await applyPomodoroAction(db, "stop", T0 + 60 * MIN);

			expect(hidePomodoroLive).not.toHaveBeenCalled();
			expect(cancelPomodoroAlerts).toHaveBeenCalled();
		});
	});

	test("lê o perfil do banco para decidir se avisa (a store está vazia sem o app)", async () => {
		await db.execAsync(
			"INSERT INTO profile (id, username, notifications_enabled) VALUES (1, 'Arthur', 1)",
		);
		await startedFocus();

		await applyPomodoroAction(db, "pause", T0 + MIN);

		expect(showPomodoroLive).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				username: "Arthur",
				notificationsEnabled: true,
			}),
		);
	});

	describe("notifyActivePhase", () => {
		test("foco correndo: notificação primeiro e depois os avisos, prevendo a pausa longa no 4º foco", async () => {
			const order: string[] = [];
			(showPomodoroLive as jest.Mock).mockImplementationOnce(async () => {
				order.push("live");
			});
			(schedulePomodoroAlerts as jest.Mock).mockImplementationOnce(async () => {
				order.push("alerts");
			});
			const row = await startedFocus({ cycleCount: 3 });

			await notifyActivePhase(row, undefined, T0);

			expect(order).toEqual(["live", "alerts"]);
			expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
				{
					focusEndsAt: T0 + 25 * MIN,
					breakMinutes: 15,
					breakEndsAt: T0 + 40 * MIN,
				},
				undefined,
			);
		});
	});
});
