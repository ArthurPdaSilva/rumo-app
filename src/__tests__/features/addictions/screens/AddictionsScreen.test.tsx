import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { AddictionsScreen } from "../../../../features/addictions/screens/AddictionsScreen";
import { useAddictionStore } from "../../../../features/addictions/stores/AddictionStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
const mockPush = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));
jest.mock("../../../../utils/useNow", () => ({
	useNow: () => new Date("2026-11-04T12:00:00.000Z"),
}));

describe("AddictionsScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
		mockPush.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("mostra o estado vazio quando não há vícios", async () => {
		await render(<AddictionsScreen />);

		expect(await screen.findByText("Nenhum vício cadastrado")).toBeTruthy();
	});

	test("lista os vícios cadastrados e abre o detalhe", async () => {
		await useAddictionStore.getState().add(mockDb, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-25T12:00:00.000Z",
		});
		await render(<AddictionsScreen />);

		await fireEvent.press(await screen.findByText("Cigarro"));

		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/addictions/[id]",
			params: { id: "1" },
		});
		expect(screen.queryByText("Nenhum vício cadastrado")).toBeNull();
	});

	test("o botão adiciona um novo vício", async () => {
		await render(<AddictionsScreen />);

		await fireEvent.press(screen.getByText("Adicionar vício"));

		expect(mockPush).toHaveBeenCalledWith("/addictions/new");
	});

	test("mostra toast de erro se não conseguir carregar", async () => {
		useAddictionStore.setState({
			load: jest.fn().mockRejectedValue(new Error("falha")),
		});

		await render(<AddictionsScreen />);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível carregar os seus vícios.",
				}),
			),
		);
	});
});
