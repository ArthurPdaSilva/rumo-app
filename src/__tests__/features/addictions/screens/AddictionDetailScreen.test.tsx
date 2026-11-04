import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { listAddictions } from "../../../../database/repositories/addictionRepository";
import { AddictionDetailScreen } from "../../../../features/addictions/screens/AddictionDetailScreen";
import { useAddictionStore } from "../../../../features/addictions/stores/AddictionStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
let mockId = "1";
const mockBack = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
	useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock("../../../../utils/useNow", () => ({
	useNow: () => new Date("2026-11-04T12:00:00.000Z"),
}));

describe("AddictionDetailScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		mockId = "1";
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
		await useAddictionStore.getState().add(mockDb, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-25T12:00:00.000Z",
		});
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
		mockBack.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("mostra o contador de dias e o próximo marco", async () => {
		await render(<AddictionDetailScreen />);

		expect(
			(await screen.findByLabelText("Dias sem ceder")).props.children,
		).toBe(10);
		expect(screen.getByText("Cigarro")).toBeTruthy();
		expect(screen.getByText("Próximo marco: 14 dias (faltam 4)")).toBeTruthy();
		expect(screen.getByText("Nenhuma recaída registrada.")).toBeTruthy();
	});

	test("registra recaída com nota, reinicia a contagem e avisa", async () => {
		await render(<AddictionDetailScreen />);

		await fireEvent.press(await screen.findByText("Registrei uma recaída"));
		await fireEvent.changeText(
			screen.getByLabelText("Quer anotar o que aconteceu? (opcional)"),
			"estresse no trabalho",
		);
		await fireEvent.press(screen.getByText("Reiniciar contagem"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Contagem reiniciada. Um dia de cada vez.",
				}),
			),
		);
		expect(await screen.findByText("estresse no trabalho")).toBeTruthy();
		expect(screen.queryByText("Nenhuma recaída registrada.")).toBeNull();
	});

	test("cancelar a recaída não altera nada", async () => {
		await render(<AddictionDetailScreen />);

		await fireEvent.press(await screen.findByText("Registrei uma recaída"));
		await fireEvent.press(screen.getByText("Cancelar"));

		expect(Toast.show).not.toHaveBeenCalled();
		expect(screen.getByText("Nenhuma recaída registrada.")).toBeTruthy();
	});

	test("exclui o vício, avisa e volta", async () => {
		await render(<AddictionDetailScreen />);

		await fireEvent.press(await screen.findByText("Excluir vício"));
		await fireEvent.press(screen.getByText("Excluir"));

		await waitFor(() => expect(mockBack).toHaveBeenCalled());
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Vício excluído." }),
		);
		expect(await listAddictions(mockDb)).toEqual([]);
	});

	test("mostra aviso quando o vício não existe", async () => {
		mockId = "999";
		await render(<AddictionDetailScreen />);

		expect(await screen.findByText("Vício não encontrado")).toBeTruthy();
	});
});
