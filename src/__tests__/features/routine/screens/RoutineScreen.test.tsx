import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { RoutineScreen } from "../../../../features/routine/screens/RoutineScreen";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
const mockPush = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));
// Quarta-feira, 14:15 (horário local).
jest.mock("../../../../utils/useNow", () => ({
	useNow: () => new Date(2026, 10, 4, 14, 15),
}));

async function seed() {
	await mockDb.execAsync(`
		INSERT INTO routine_blocks (weekdays, start_time, end_time, title, reminder_minutes) VALUES
			(62, '09:40', '10:40', 'Concurso 1', 10),
			(62, '14:00', '15:00', 'Concurso 3', 10),
			(62, '16:00', '17:00', 'Inglês', 0),
			(64, '10:00', '11:00', 'Casa', 10);
		INSERT INTO tasks (section, title, done) VALUES
			('Português', 'Classes de palavras', 0),
			('Português', 'Pontuação', 1),
			('Informática', 'Aula 01', 0);
		INSERT INTO weekly_goals (activity, target_minutes, note) VALUES
			('Português', 240, NULL),
			('Música', 265, '35 min por dia útil');
	`);
}

describe("RoutineScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useRoutineStore.setState({
			blocks: [],
			tasks: [],
			goals: [],
			isLoaded: false,
		});
		mockPush.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("mostra os blocos de hoje, destacando o atual e o próximo", async () => {
		await seed();
		await render(<RoutineScreen />);

		expect(await screen.findByText("Concurso 3")).toBeTruthy();
		expect(screen.getByText("Quarta (hoje)")).toBeTruthy();
		expect(
			screen.getByLabelText("14:00–15:00, Concurso 3, agora"),
		).toBeTruthy();
		expect(screen.getByLabelText("16:00–17:00, Inglês, próximo")).toBeTruthy();
		expect(screen.getByLabelText("09:40–10:40, Concurso 1")).toBeTruthy();
		expect(screen.getByText("Sem lembrete")).toBeTruthy();
		expect(screen.queryByText("Casa")).toBeNull();
	});

	test("trocar de dia mostra os blocos daquele dia, sem destaque", async () => {
		await seed();
		await render(<RoutineScreen />);
		await screen.findByText("Concurso 3");

		await fireEvent.press(screen.getByLabelText("Sábado"));

		expect(screen.getByLabelText("10:00–11:00, Casa")).toBeTruthy();
		expect(screen.queryByText("Concurso 3")).toBeNull();
		expect(screen.queryByText("Agora")).toBeNull();
	});

	test("dia sem blocos mostra o estado vazio", async () => {
		await seed();
		await render(<RoutineScreen />);
		await screen.findByText("Concurso 3");

		await fireEvent.press(screen.getByLabelText("Domingo"));

		expect(screen.getByText("Nenhum bloco neste dia")).toBeTruthy();
	});

	test("o botão leva à tela de envio para a agenda", async () => {
		await seed();
		await render(<RoutineScreen />);

		await fireEvent.press(await screen.findByText("Enviar para a agenda"));

		expect(mockPush).toHaveBeenCalledWith("/calendar");
	});

	test("abre o bloco para editar e o formulário de novo bloco no dia escolhido", async () => {
		await seed();
		await render(<RoutineScreen />);
		await fireEvent.press(
			await screen.findByLabelText("14:00–15:00, Concurso 3, agora"),
		);
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/blocks/[id]",
			params: { id: "2" },
		});

		await fireEvent.press(screen.getByLabelText("Sábado"));
		await fireEvent.press(screen.getByText("Adicionar bloco"));
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/blocks/new",
			params: { weekday: "6" },
		});
	});

	test("tarefas por seção, com contagem, e marcar/desmarcar com toast", async () => {
		await seed();
		await render(<RoutineScreen />);
		await fireEvent.press(await screen.findByText("Tarefas"));

		expect(screen.getByText("Português (1/2)")).toBeTruthy();
		expect(screen.getByText("Informática (0/1)")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("Classes de palavras"));
		await waitFor(() =>
			expect(screen.getByText("Português (2/2)")).toBeTruthy(),
		);
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Tarefa concluída." }),
		);
		const row = await mockDb.getFirstAsync<{ done: number }>(
			"SELECT done FROM tasks WHERE title = 'Classes de palavras'",
		);
		expect(row?.done).toBe(1);

		await fireEvent.press(screen.getByLabelText("Classes de palavras"));
		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({ text2: "Tarefa reaberta." }),
			),
		);
	});

	test("tarefa marcada aparece como marcada para acessibilidade", async () => {
		await seed();
		await render(<RoutineScreen />);
		await fireEvent.press(await screen.findByText("Tarefas"));

		expect(screen.getByLabelText("Pontuação").props.accessibilityState).toEqual(
			{ checked: true },
		);
		expect(screen.getByLabelText("Aula 01").props.accessibilityState).toEqual({
			checked: false,
		});
	});

	test("metas semanais com horas formatadas e notas", async () => {
		await seed();
		await render(<RoutineScreen />);
		await fireEvent.press(await screen.findByText("Metas"));

		expect(screen.getByText("4h por semana")).toBeTruthy();
		expect(screen.getByText("4h25 por semana")).toBeTruthy();
		expect(screen.getByText("35 min por dia útil")).toBeTruthy();
		expect(
			screen.getByText(/progresso de cada meta aparece na aba Foco/),
		).toBeTruthy();
	});

	test("sem dados importados, cada aba orienta a importar", async () => {
		await render(<RoutineScreen />);
		expect(await screen.findByText("Nenhum bloco neste dia")).toBeTruthy();

		await fireEvent.press(screen.getByText("Tarefas"));
		expect(screen.getByText("Nenhuma tarefa")).toBeTruthy();

		await fireEvent.press(screen.getByText("Metas"));
		expect(screen.getByText("Nenhuma meta semanal")).toBeTruthy();
	});

	test("mostra toast de erro se não conseguir carregar", async () => {
		useRoutineStore.setState({
			load: jest.fn().mockRejectedValue(new Error("falha")),
		});

		await render(<RoutineScreen />);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível carregar a sua rotina.",
				}),
			),
		);
	});
});
