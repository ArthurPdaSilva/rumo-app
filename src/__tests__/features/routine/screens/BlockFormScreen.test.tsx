import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { listBlocks } from "../../../../database/repositories/routineRepository";
import { BlockFormScreen } from "../../../../features/routine/screens/BlockFormScreen";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
let mockParams: { id?: string; weekday?: string } = {};
const mockBack = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
	useLocalSearchParams: () => mockParams,
}));

jest.setTimeout(20000);

describe("BlockFormScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		mockParams = {};
		useRoutineStore.setState({
			blocks: [],
			tasks: [],
			goals: [],
			isLoaded: false,
		});
		mockBack.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("cria um bloco no dia escolhido, com lembrete padrão de 10 minutos", async () => {
		mockParams = { weekday: "6" };
		await render(<BlockFormScreen />);

		expect(screen.getByLabelText("Sábado").props.accessibilityState).toEqual({
			checked: true,
		});
		expect(screen.getByLabelText("Segunda").props.accessibilityState).toEqual({
			checked: false,
		});
		expect(screen.getByLabelText(/Lembrete/).props.value).toBe("10");

		await fireEvent.changeText(screen.getByLabelText("Nome do bloco"), "Casa");
		await fireEvent.changeText(screen.getByLabelText("Início"), "10:00");
		await fireEvent.changeText(
			screen.getByLabelText("Fim (opcional)"),
			"11:30",
		);
		await fireEvent.press(screen.getByText("Salvar bloco"));

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Bloco criado." }),
		);
		expect(await listBlocks(mockDb)).toEqual([
			expect.objectContaining({
				title: "Casa",
				startTime: "10:00",
				endTime: "11:30",
				weekdays: 64,
				reminderMinutes: 10,
				notes: null,
			}),
		]);
	});

	test("escolher vários dias e desligar o lembrete", async () => {
		mockParams = { weekday: "1" };
		await render(<BlockFormScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("Nome do bloco"),
			"Treino",
		);
		await fireEvent.press(screen.getByLabelText("Quarta"));
		await fireEvent.changeText(screen.getByLabelText(/Lembrete/), "0");
		await fireEvent.press(screen.getByText("Salvar bloco"));

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		const [saved] = await listBlocks(mockDb);
		expect(saved).toMatchObject({
			weekdays: 2 | 8,
			reminderMinutes: 0,
			endTime: null,
		});
	});

	test("recusa nome vazio, horário inválido e nenhum dia", async () => {
		mockParams = { weekday: "1" };
		await render(<BlockFormScreen />);

		await fireEvent.changeText(screen.getByLabelText("Início"), "25:00");
		await fireEvent.press(screen.getByLabelText("Segunda"));
		await fireEvent.press(screen.getByText("Salvar bloco"));

		expect(await screen.findByText("Dê um nome ao bloco")).toBeTruthy();
		expect(screen.getByText("Use o formato HH:MM")).toBeTruthy();
		expect(screen.getByText("Escolha pelo menos um dia")).toBeTruthy();
		expect(await listBlocks(mockDb)).toEqual([]);
		expect(mockBack).not.toHaveBeenCalled();
	});

	test("edita um bloco existente com os valores atuais", async () => {
		await mockDb.runAsync(
			"INSERT INTO routine_blocks (id, weekdays, start_time, end_time, title, notes, reminder_minutes) VALUES (5, 62, '09:40', '10:40', 'Concurso 1', 'anotação', 15)",
		);
		mockParams = { id: "5" };
		await render(<BlockFormScreen />);

		await waitFor(() =>
			expect(screen.getByLabelText("Nome do bloco").props.value).toBe(
				"Concurso 1",
			),
		);
		expect(screen.getByLabelText("Início").props.value).toBe("09:40");
		expect(screen.getByLabelText(/Lembrete/).props.value).toBe("15");
		expect(screen.getByLabelText("Anotações (opcional)").props.value).toBe(
			"anotação",
		);

		await fireEvent.changeText(
			screen.getByLabelText("Nome do bloco"),
			"Concurso 2",
		);
		await fireEvent.press(screen.getByText("Salvar bloco"));

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Bloco salvo." }),
		);
		expect((await listBlocks(mockDb))[0].title).toBe("Concurso 2");
	});

	test("exclui o bloco depois de confirmar", async () => {
		await mockDb.runAsync(
			"INSERT INTO routine_blocks (id, weekdays, start_time, title) VALUES (5, 62, '09:40', 'Concurso 1')",
		);
		mockParams = { id: "5" };
		await render(<BlockFormScreen />);

		await fireEvent.press(await screen.findByText("Excluir bloco"));
		expect(screen.getByText("Excluir Concurso 1?")).toBeTruthy();
		await fireEvent.press(screen.getByText("Excluir"));

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Bloco excluído." }),
		);
		expect(await listBlocks(mockDb)).toEqual([]);
	});

	test("bloco inexistente mostra aviso", async () => {
		mockParams = { id: "999" };
		await render(<BlockFormScreen />);
		expect(await screen.findByText("Bloco não encontrado")).toBeTruthy();
	});

	test("novo bloco não mostra o botão de excluir", async () => {
		await render(<BlockFormScreen />);

		expect(screen.queryByText("Excluir bloco")).toBeNull();
	});

	test("mostra erro se o banco falhar ao salvar", async () => {
		useRoutineStore.setState({
			addBlock: jest.fn().mockRejectedValue(new Error("falha")),
		});
		await render(<BlockFormScreen />);

		await fireEvent.changeText(screen.getByLabelText("Nome do bloco"), "X");
		await fireEvent.press(screen.getByText("Salvar bloco"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível salvar o bloco. Tente novamente.",
				}),
			),
		);
		expect(mockBack).not.toHaveBeenCalled();
	});
});
