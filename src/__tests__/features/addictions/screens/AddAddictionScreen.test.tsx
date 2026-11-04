import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { listAddictions } from "../../../../database/repositories/addictionRepository";
import { AddAddictionScreen } from "../../../../features/addictions/screens/AddAddictionScreen";
import { useAddictionStore } from "../../../../features/addictions/stores/AddictionStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
const mockBack = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));

async function fillAndSubmit(name: string, date = "01/10/2026") {
	await fireEvent.changeText(screen.getByLabelText("Nome"), name);
	await fireEvent.changeText(screen.getByLabelText("Data em que parou"), date);
	await fireEvent.changeText(
		screen.getByLabelText("Hora em que parou"),
		"10:00",
	);
	await fireEvent.press(screen.getByText("Salvar vício"));
}

describe("AddAddictionScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
		mockBack.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("salva o vício, avisa com toast e volta", async () => {
		await render(<AddAddictionScreen />);

		await fireEvent.press(screen.getByLabelText("Ícone smoking"));
		await fillAndSubmit("Cigarro");

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "success",
				text2: "Vício adicionado. Um dia de cada vez.",
			}),
		);
		const [saved] = await listAddictions(mockDb);
		expect(saved).toMatchObject({ name: "Cigarro", icon: "smoking" });
		expect(new Date(saved.quitAt).getTime()).toBe(
			new Date(2026, 9, 1, 10, 0).getTime(),
		);
	});

	test("recusa nome curto sem salvar", async () => {
		await render(<AddAddictionScreen />);

		await fillAndSubmit("A");

		expect(await screen.findByText("Use pelo menos 2 caracteres")).toBeTruthy();
		expect(await listAddictions(mockDb)).toEqual([]);
		expect(mockBack).not.toHaveBeenCalled();
	});

	test("recusa data inexistente", async () => {
		await render(<AddAddictionScreen />);

		await fillAndSubmit("Cigarro", "31/02/2026");

		expect(await screen.findByText("Data inválida")).toBeTruthy();
		expect(await listAddictions(mockDb)).toEqual([]);
	});

	test("recusa data no futuro", async () => {
		await render(<AddAddictionScreen />);

		await fillAndSubmit("Cigarro", "01/01/2999");

		expect(
			await screen.findByText("A data não pode estar no futuro"),
		).toBeTruthy();
		expect(await listAddictions(mockDb)).toEqual([]);
	});

	test("mostra toast de erro se o banco falhar", async () => {
		useAddictionStore.setState({
			add: jest.fn().mockRejectedValue(new Error("falha")),
		});
		await render(<AddAddictionScreen />);

		await fillAndSubmit("Cigarro");

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível salvar o vício. Tente novamente.",
				}),
			),
		);
		expect(mockBack).not.toHaveBeenCalled();
	});
});
