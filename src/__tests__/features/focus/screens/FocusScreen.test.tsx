import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { migrateDatabase } from "../../../../database/client";
import { useFocusStore } from "../../../../features/focus/stores/FocusStore";
import { FocusScreen } from "../../../../features/focus/screens/FocusScreen";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
// Quarta-feira, 14:15 (horário local).
const NOW = new Date(2026, 10, 4, 14, 15);
jest.mock("../../../../utils/useNow", () => ({
	useNow: () => new Date(2026, 10, 4, 14, 15),
}));

async function seed() {
	await mockDb.execAsync(`
		INSERT INTO routine_blocks (weekdays, start_time, end_time, title, reminder_minutes) VALUES
			(62, '14:00', '15:00', 'Concurso 3', 10);
		INSERT INTO tasks (id, section, title, done) VALUES
			(1, 'Português', 'Pontuação', 0),
			(2, 'Português', 'Crase', 1),
			(3, 'Informática', 'Aula 01', 0);
		INSERT INTO weekly_goals (activity, target_minutes) VALUES
			('Português', 240),
			('Música', 265);
	`);
}

describe("FocusScreen", () => {
	beforeEach(async () => {
		jest.spyOn(Date, "now").mockReturnValue(NOW.getTime());
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useFocusStore.getState().reset();
		useRoutineStore.setState({
			blocks: [],
			tasks: [],
			goals: [],
			isLoaded: false,
		});
	});

	afterEach(() => {
		useFocusStore.getState().reset();
		jest.restoreAllMocks();
		mockDb.close();
	});

	test("parado: mostra 25:00 e sugere o bloco em andamento", async () => {
		await seed();
		await render(<FocusScreen />);

		expect(screen.getByText("Pronto para focar")).toBeTruthy();
		expect(screen.getByText("25:00")).toBeTruthy();
		await waitFor(() =>
			expect(
				screen.getByRole("radio", { name: "Concurso 3" }).props
					.accessibilityState.selected,
			).toBe(true),
		);
	});

	test("iniciar grava a sessão ligada ao bloco e mostra o foco", async () => {
		await seed();
		await render(<FocusScreen />);
		await waitFor(() => screen.getByRole("radio", { name: "Concurso 3" }));

		await fireEvent.press(screen.getByText("Iniciar foco (25 min)"));

		expect(await screen.findByText("Cancelar foco")).toBeTruthy();
		expect(screen.getByText("Foco")).toBeTruthy();
		const row = await mockDb.getFirstAsync<{
			activity: string;
			routine_block_id: number;
		}>("SELECT activity, routine_block_id FROM pomodoro_sessions");
		expect(row?.activity).toBe("Concurso 3");
		expect(row?.routine_block_id).toBe(1);
	});

	test("só oferece tarefas abertas da atividade escolhida", async () => {
		await seed();
		await render(<FocusScreen />);
		await fireEvent.press(
			await screen.findByRole("radio", { name: "Português" }),
		);

		expect(screen.getByRole("radio", { name: "Pontuação" })).toBeTruthy();
		expect(screen.queryByRole("radio", { name: "Crase" })).toBeNull();
		expect(screen.queryByRole("radio", { name: "Aula 01" })).toBeNull();
	});

	test("em andamento: mostra o tempo restante e cancela após confirmar", async () => {
		await seed();
		await render(<FocusScreen />);
		await waitFor(() => screen.getByText("Hoje"));
		useFocusStore.setState({
			phase: {
				kind: "focus",
				startedAtMs: NOW.getTime() - 5 * 60_000,
				durationMs: 25 * 60_000,
				sessionId: null,
				target: { activity: "Português", routineBlockId: null, taskId: null },
			},
		});

		expect(await screen.findByText("20:00")).toBeTruthy();
		await fireEvent.press(screen.getByText("Cancelar foco"));
		expect(screen.getByText("Cancelar o foco?")).toBeTruthy();
		await fireEvent.press(screen.getAllByText("Cancelar foco")[1]);

		await waitFor(() => expect(useFocusStore.getState().phase).toBeNull());
	});

	test("na pausa permite pular", async () => {
		await seed();
		await render(<FocusScreen />);
		await waitFor(() => screen.getByText("Hoje"));
		useFocusStore.setState({
			phase: {
				kind: "break",
				startedAtMs: NOW.getTime(),
				durationMs: 5 * 60_000,
				sessionId: null,
				target: { activity: null, routineBlockId: null, taskId: null },
			},
		});

		expect(await screen.findByText("Pausa curta")).toBeTruthy();
		await fireEvent.press(screen.getByText("Pular pausa"));
		expect(useFocusStore.getState().phase).toBeNull();
	});

	test("fase vencida em segundo plano é fechada ao voltar para a tela", async () => {
		await seed();
		await useRoutineStore.getState().load(mockDb);
		const startedAt = new Date(NOW.getTime() - 30 * 60_000);
		const id = (
			await mockDb.runAsync(
				"INSERT INTO pomodoro_sessions (started_at, kind, activity) VALUES (?, 'focus', 'Música')",
				startedAt.toISOString(),
			)
		).lastInsertRowId;
		useFocusStore.setState({
			phase: {
				kind: "focus",
				startedAtMs: startedAt.getTime(),
				durationMs: 25 * 60_000,
				sessionId: id,
				target: { activity: "Música", routineBlockId: null, taskId: null },
			},
			isLoaded: true,
		});
		await render(<FocusScreen />);

		await waitFor(() =>
			expect(useFocusStore.getState().phase?.kind).toBe("break"),
		);
		const row = await mockDb.getFirstAsync<{ completed: number }>(
			"SELECT completed FROM pomodoro_sessions WHERE id = ?",
			id,
		);
		expect(row?.completed).toBe(1);
	});

	test("pergunta se conclui a tarefa e marca ao confirmar", async () => {
		await seed();
		await render(<FocusScreen />);
		await waitFor(() => screen.getByText("Hoje"));
		useFocusStore.setState({ taskPrompt: { taskId: 1, title: "Pontuação" } });

		expect(await screen.findByText("Concluir a tarefa?")).toBeTruthy();
		await fireEvent.press(screen.getByText("Concluir"));

		await waitFor(async () => {
			const row = await mockDb.getFirstAsync<{ done: number }>(
				"SELECT done FROM tasks WHERE id = 1",
			);
			expect(row?.done).toBe(1);
		});
	});

	test("mostra o progresso das metas da semana", async () => {
		await seed();
		await mockDb.execAsync(`
			INSERT INTO pomodoro_sessions (started_at, ended_at, kind, activity, completed) VALUES
				('2026-11-03T15:00:00.000Z', '2026-11-03T15:25:00.000Z', 'focus', 'Português', 1),
				('2026-11-04T10:00:00.000Z', '2026-11-04T10:25:00.000Z', 'focus', 'Português', 1);
		`);
		await render(<FocusScreen />);

		expect(await screen.findByText("50 min / 4h")).toBeTruthy();
		expect(screen.getByText("0 min / 4h25")).toBeTruthy();
		expect(screen.getByText("1 foco · 25 min")).toBeTruthy();
	});

	test("o interruptor troca entre perguntar e concluir sozinho", async () => {
		await seed();
		await render(<FocusScreen />);

		await fireEvent(
			await screen.findByLabelText("Concluir a tarefa sozinho"),
			"valueChange",
			true,
		);

		await waitFor(() =>
			expect(useFocusStore.getState().onFocusEnd).toBe("auto_complete"),
		);
		const row = await mockDb.getFirstAsync<{ value: string }>(
			"SELECT pomodoro_on_focus_end AS value FROM app_state",
		);
		expect(row?.value).toBe("auto_complete");
	});
});
