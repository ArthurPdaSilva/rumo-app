import { migrateDatabase } from "../../../../database/client";
import { useFocusStore } from "../../../../features/focus/stores/FocusStore";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { applyPomodoroAction } from "../../../../features/focus/pomodoroActions";
import {
	cancelPomodoroAlerts,
	schedulePomodoroAlerts,
	showPomodoroLive,
} from "../../../../features/notifications/pomodoroAlerts";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

jest.mock("../../../../features/notifications/pomodoroAlerts", () => ({
	schedulePomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	cancelPomodoroAlerts: jest.fn().mockResolvedValue(undefined),
	showPomodoroLive: jest.fn().mockResolvedValue(undefined),
	hidePomodoroLive: jest.fn().mockResolvedValue(undefined),
	settlePomodoroLive: jest.fn().mockResolvedValue(undefined),
}));

const T0 = new Date(2026, 10, 4, 14, 0).getTime();
const MIN = 60_000;
const free = { activity: null, routineBlockId: null, taskId: null };

type Db = ReturnType<typeof createTestDatabase>;
let db: Db;

async function seedTask() {
	await db.execAsync(
		"INSERT INTO tasks (id, section, title, done) VALUES (1, 'Português', 'Pontuação', 0)",
	);
	await useRoutineStore.getState().load(db);
}

describe("useFocusStore", () => {
	beforeEach(async () => {
		jest.useFakeTimers({ now: T0 });
		db = createTestDatabase();
		await migrateDatabase(db);
		useFocusStore.getState().reset();
		useRoutineStore.setState({
			blocks: [],
			tasks: [],
			goals: [],
			isLoaded: false,
		});
		jest.clearAllMocks();
	});

	afterEach(() => {
		useFocusStore.getState().reset();
		jest.useRealTimers();
		db.close();
	});

	test("iniciar grava a sessão aberta e ignora um segundo início", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		await useFocusStore.getState().startFocus(db, free, T0);

		const rows = await db.getAllAsync("SELECT * FROM pomodoro_sessions");
		expect(rows).toHaveLength(1);
		expect(useFocusStore.getState().phase).toMatchObject({
			kind: "focus",
			durationMs: 25 * MIN,
		});
	});

	test("ao fim dos 25 min conclui a sessão e começa a pausa curta", async () => {
		await useFocusStore
			.getState()
			.startFocus(db, { ...free, activity: "Português" }, T0);
		await jest.advanceTimersByTimeAsync(25 * MIN);

		const state = useFocusStore.getState();
		expect(state.phase).toMatchObject({ kind: "break", durationMs: 5 * MIN });
		expect(state.cycleCount).toBe(1);
		expect(state.today).toEqual({ sessions: 1, minutes: 25 });
		expect(state.weekMinutes).toEqual({ Português: 25 });
		expect(state.notice).toContain("Foco concluído");
		const row = await db.getFirstAsync<{ ended_at: string; completed: number }>(
			"SELECT ended_at, completed FROM pomodoro_sessions",
		);
		expect(row).toEqual({
			ended_at: new Date(T0 + 25 * MIN).toISOString(),
			completed: 1,
		});
	});

	test("o quarto foco leva à pausa longa e depois zera o ciclo", async () => {
		const store = useFocusStore.getState();
		for (let i = 0; i < 3; i++) {
			await store.startFocus(db, free, Date.now());
			await jest.advanceTimersByTimeAsync(25 * MIN);
			await useFocusStore.getState().skipBreak(db);
		}
		await store.startFocus(db, free, Date.now());
		await jest.advanceTimersByTimeAsync(25 * MIN);
		expect(useFocusStore.getState().phase).toMatchObject({
			kind: "longBreak",
			durationMs: 15 * MIN,
		});
		expect(useFocusStore.getState().cycleCount).toBe(4);

		await jest.advanceTimersByTimeAsync(15 * MIN);
		expect(useFocusStore.getState().phase).toBeNull();
		expect(useFocusStore.getState().cycleCount).toBe(0);
	});

	test("finishPhase antes da hora não faz nada", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		await useFocusStore.getState().finishPhase(db, T0 + 24 * MIN);

		expect(useFocusStore.getState().phase?.kind).toBe("focus");
	});

	test("cancelar fecha a sessão sem contar para as metas", async () => {
		await useFocusStore
			.getState()
			.startFocus(db, { ...free, activity: "Português" }, T0);
		await useFocusStore.getState().cancelPhase(db, T0 + 10 * MIN);
		await useFocusStore.getState().load(db, T0 + 10 * MIN);

		expect(useFocusStore.getState().phase).toBeNull();
		expect(useFocusStore.getState().today.sessions).toBe(0);
		const row = await db.getFirstAsync<{ completed: number }>(
			"SELECT completed FROM pomodoro_sessions",
		);
		expect(row?.completed).toBe(0);
	});

	test("modo ask: pergunta antes de concluir a tarefa", async () => {
		await seedTask();
		await useFocusStore
			.getState()
			.startFocus(
				db,
				{ activity: "Português", routineBlockId: null, taskId: 1 },
				T0,
			);
		await jest.advanceTimersByTimeAsync(25 * MIN);

		expect(useFocusStore.getState().taskPrompt).toEqual({
			taskId: 1,
			title: "Pontuação",
		});
		expect(useRoutineStore.getState().tasks[0]?.done).toBe(false);

		await useFocusStore.getState().confirmTaskPrompt(db);
		expect(useFocusStore.getState().taskPrompt).toBeNull();
		expect(useRoutineStore.getState().tasks[0]?.done).toBe(true);
		const row = await db.getFirstAsync<{ done: number }>(
			"SELECT done FROM tasks WHERE id = 1",
		);
		expect(row?.done).toBe(1);
	});

	test("modo auto_complete: conclui a tarefa sem perguntar", async () => {
		await seedTask();
		await useFocusStore.getState().changeOnFocusEnd(db, "auto_complete");
		await useFocusStore
			.getState()
			.startFocus(
				db,
				{ activity: "Português", routineBlockId: null, taskId: 1 },
				T0,
			);
		await jest.advanceTimersByTimeAsync(25 * MIN);

		expect(useFocusStore.getState().taskPrompt).toBeNull();
		expect(useFocusStore.getState().notice).toContain("Pontuação");
		expect(useRoutineStore.getState().tasks[0]?.done).toBe(true);
	});

	test("recusar a pergunta mantém a tarefa aberta", async () => {
		await seedTask();
		await useFocusStore
			.getState()
			.startFocus(
				db,
				{ activity: "Português", routineBlockId: null, taskId: 1 },
				T0,
			);
		await jest.advanceTimersByTimeAsync(25 * MIN);
		useFocusStore.getState().dismissTaskPrompt();

		expect(useFocusStore.getState().taskPrompt).toBeNull();
		expect(useRoutineStore.getState().tasks[0]?.done).toBe(false);
	});

	test("pular a pausa libera para um novo foco", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		await jest.advanceTimersByTimeAsync(25 * MIN);
		await useFocusStore.getState().skipBreak(db);

		expect(useFocusStore.getState().phase).toBeNull();
		expect(useFocusStore.getState().cycleCount).toBe(1);
	});

	test("load encerra sessões abertas de um app que foi fechado", async () => {
		await db.execAsync(
			"INSERT INTO pomodoro_sessions (started_at, kind) VALUES ('2026-11-04T10:00:00.000Z', 'focus')",
		);
		await useFocusStore.getState().load(db, T0);

		const row = await db.getFirstAsync<{ ended_at: string | null }>(
			"SELECT ended_at FROM pomodoro_sessions",
		);
		expect(row?.ended_at).toBe("2026-11-04T10:00:00.000Z");
		expect(useFocusStore.getState().isLoaded).toBe(true);
	});

	test("load não encerra a sessão do foco em andamento", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		await useFocusStore.getState().load(db, T0);

		const row = await db.getFirstAsync<{ ended_at: string | null }>(
			"SELECT ended_at FROM pomodoro_sessions",
		);
		expect(row?.ended_at).toBeNull();
	});

	test("iniciar agenda os avisos de fim de foco e de pausa curta", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);

		expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
			{
				focusEndsAt: T0 + 25 * MIN,
				breakMinutes: 5,
				breakEndsAt: T0 + 30 * MIN,
			},
			undefined,
		);
	});

	test("o aviso do quarto foco já prevê a pausa longa", async () => {
		for (let i = 0; i < 3; i++) {
			await useFocusStore.getState().startFocus(db, free, Date.now());
			await jest.advanceTimersByTimeAsync(25 * MIN);
			await useFocusStore.getState().skipBreak(db);
		}
		jest.clearAllMocks();
		const start = Date.now();
		await useFocusStore.getState().startFocus(db, free, start);

		expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
			{
				focusEndsAt: start + 25 * MIN,
				breakMinutes: 15,
				breakEndsAt: start + 40 * MIN,
			},
			undefined,
		);
	});

	test("cancelar o foco e pular a pausa cancelam os avisos", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		await useFocusStore.getState().cancelPhase(db, T0 + MIN);
		expect(cancelPomodoroAlerts).toHaveBeenCalledTimes(1);

		await useFocusStore.getState().startFocus(db, free, Date.now());
		await jest.advanceTimersByTimeAsync(25 * MIN);
		await useFocusStore.getState().skipBreak(db);
		expect(cancelPomodoroAlerts).toHaveBeenCalledTimes(2);
	});

	test("falha ao agendar o aviso não impede o foco", async () => {
		(schedulePomodoroAlerts as jest.Mock).mockRejectedValueOnce(
			new Error("sem módulo"),
		);
		await useFocusStore.getState().startFocus(db, free, T0);

		expect(useFocusStore.getState().phase?.kind).toBe("focus");
	});

	test("voltar tarde ao app: a pausa conta a partir do fim do foco", async () => {
		await useFocusStore.getState().startFocus(db, free, T0);
		jest.clearAllTimers();
		await useFocusStore.getState().finishPhase(db, T0 + 27 * MIN);

		expect(useFocusStore.getState().phase).toMatchObject({
			kind: "break",
			startedAtMs: T0 + 25 * MIN,
		});
	});

	describe("app encerrado em segundo plano", () => {
		/** Simula o Android matando o processo: a memória some, o banco fica. */
		function killProcess() {
			jest.clearAllTimers();
			useFocusStore.getState().reset();
		}

		test("o foco continua de onde parou quando o app é reaberto", async () => {
			await useFocusStore
				.getState()
				.startFocus(db, { ...free, activity: "Português" }, T0);
			killProcess();
			expect(useFocusStore.getState().phase).toBeNull();

			await useFocusStore.getState().load(db, T0 + 10 * MIN);

			expect(useFocusStore.getState().phase).toMatchObject({
				kind: "focus",
				startedAtMs: T0,
				target: { activity: "Português" },
			});
			const open = await db.getFirstAsync<{ ended_at: string | null }>(
				"SELECT ended_at FROM pomodoro_sessions",
			);
			// A sessão não é mais "abandonada" só porque o app foi fechado.
			expect(open?.ended_at).toBeNull();
		});

		test("se o foco acabou enquanto o app estava morto, os minutos contam", async () => {
			await useFocusStore
				.getState()
				.startFocus(db, { ...free, activity: "Português" }, T0);
			killProcess();

			await useFocusStore.getState().restore(db, T0 + 27 * MIN);

			const state = useFocusStore.getState();
			expect(state.today).toEqual({ sessions: 1, minutes: 25 });
			expect(state.weekMinutes).toEqual({ Português: 25 });
			expect(state.cycleCount).toBe(1);
			// A pausa corre a partir do fim do foco, não do momento em que o app voltou.
			expect(state.phase).toMatchObject({
				kind: "break",
				startedAtMs: T0 + 25 * MIN,
			});
		});

		test("voltando muito depois, fecha o foco e a pausa de uma vez", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			killProcess();

			await useFocusStore.getState().restore(db, T0 + 120 * MIN);

			const state = useFocusStore.getState();
			expect(state.phase).toBeNull();
			expect(state.today).toEqual({ sessions: 1, minutes: 25 });
			expect(
				await db.getFirstAsync("SELECT * FROM pomodoro_active"),
			).toBeNull();
		});

		test("o ciclo de focos também sobrevive", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			await jest.advanceTimersByTimeAsync(25 * MIN);
			expect(useFocusStore.getState().cycleCount).toBe(1);
			killProcess();

			await useFocusStore.getState().restore(db, Date.now());

			expect(useFocusStore.getState().cycleCount).toBe(1);
			expect(useFocusStore.getState().phase?.kind).toBe("break");
		});
	});

	describe("pausar e retomar", () => {
		test("pausar congela a fase e o timer não fecha o foco", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			await useFocusStore.getState().pausePhase(db, T0 + 10 * MIN);

			expect(useFocusStore.getState().phase).toMatchObject({
				kind: "focus",
				pausedAtMs: T0 + 10 * MIN,
			});
			await jest.advanceTimersByTimeAsync(60 * MIN);
			expect(useFocusStore.getState().phase?.kind).toBe("focus");
			expect(useFocusStore.getState().today.sessions).toBe(0);
		});

		test("retomar empurra o fim; os minutos de foco excluem o tempo parado", async () => {
			await useFocusStore
				.getState()
				.startFocus(db, { ...free, activity: "Português" }, T0);
			await useFocusStore.getState().pausePhase(db, T0 + 10 * MIN);
			await useFocusStore.getState().resumePhase(db, T0 + 40 * MIN);
			jest.clearAllTimers();

			expect(useFocusStore.getState().phase).toMatchObject({
				pausedAtMs: null,
				pausedTotalMs: 30 * MIN,
			});
			// Ainda faltam 15 min de foco: às 14:54 não acabou, às 14:55 sim.
			await useFocusStore.getState().finishPhase(db, T0 + 54 * MIN);
			expect(useFocusStore.getState().phase?.kind).toBe("focus");
			await useFocusStore.getState().finishPhase(db, T0 + 55 * MIN);

			expect(useFocusStore.getState().phase?.kind).toBe("break");
			expect(useFocusStore.getState().today).toEqual({
				sessions: 1,
				minutes: 25,
			});
			expect(useFocusStore.getState().weekMinutes).toEqual({ Português: 25 });
		});

		test("finishPhase ignora uma fase pausada mesmo muito depois do horário", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			await useFocusStore.getState().pausePhase(db, T0 + MIN);

			await useFocusStore.getState().finishPhase(db, T0 + 999 * MIN);

			expect(useFocusStore.getState().phase?.pausedAtMs).toBe(T0 + MIN);
		});

		test("o app é morto com o foco pausado: continua pausado e sem perder o tempo restante", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			await useFocusStore.getState().pausePhase(db, T0 + 10 * MIN);
			jest.clearAllTimers();
			useFocusStore.getState().reset();

			await useFocusStore.getState().restore(db, T0 + 600 * MIN);

			expect(useFocusStore.getState().phase).toMatchObject({
				kind: "focus",
				pausedAtMs: T0 + 10 * MIN,
			});
		});

		test("pausar e retomar sem fase ativa não faz nada", async () => {
			await useFocusStore.getState().pausePhase(db, T0);
			await useFocusStore.getState().resumePhase(db, T0);

			expect(useFocusStore.getState().phase).toBeNull();
		});

		test("pausar atualiza a notificação fixa e retomar reagenda os avisos", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			jest.clearAllMocks();

			await useFocusStore.getState().pausePhase(db, T0 + 10 * MIN);
			expect(showPomodoroLive).toHaveBeenCalledWith(
				expect.objectContaining({ paused: true, remainingMs: 15 * MIN }),
				null,
			);
			expect(cancelPomodoroAlerts).toHaveBeenCalled();

			await useFocusStore.getState().resumePhase(db, T0 + 20 * MIN);
			expect(schedulePomodoroAlerts).toHaveBeenCalledWith(
				expect.objectContaining({ focusEndsAt: T0 + 35 * MIN }),
				null,
			);
		});
	});

	describe("ações feitas pela notificação com o app fechado", () => {
		test("Pausar pela notificação aparece na store ao reabrir o app", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			jest.clearAllTimers();
			useFocusStore.getState().reset();
			// Quem pausou foi a tarefa em segundo plano, direto no banco.
			await applyPomodoroAction(db, "pause", T0 + 8 * MIN);

			await useFocusStore.getState().restore(db, T0 + 9 * MIN);

			expect(useFocusStore.getState().phase?.pausedAtMs).toBe(T0 + 8 * MIN);
		});

		test("Encerrar pela notificação some da store ao reabrir o app", async () => {
			await useFocusStore.getState().startFocus(db, free, T0);
			await applyPomodoroAction(db, "stop", T0 + 8 * MIN);

			await useFocusStore.getState().restore(db, T0 + 9 * MIN);

			expect(useFocusStore.getState().phase).toBeNull();
			expect(useFocusStore.getState().today.sessions).toBe(0);
		});
	});

	test("cancelar uma pausa longa zera o ciclo", async () => {
		for (let i = 0; i < 3; i++) {
			await useFocusStore.getState().startFocus(db, free, Date.now());
			await jest.advanceTimersByTimeAsync(25 * MIN);
			await useFocusStore.getState().skipBreak(db);
		}
		await useFocusStore.getState().startFocus(db, free, Date.now());
		await jest.advanceTimersByTimeAsync(25 * MIN);
		expect(useFocusStore.getState().phase?.kind).toBe("longBreak");

		await useFocusStore.getState().cancelPhase(db);

		expect(useFocusStore.getState().cycleCount).toBe(0);
	});
});
