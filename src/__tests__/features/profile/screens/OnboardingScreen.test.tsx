import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { getProfile } from "../../../../database/repositories/profileRepository";
import { OnboardingScreen } from "../../../../features/profile/screens/OnboardingScreen";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;
const mockReplace = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace }),
}));

describe("OnboardingScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useProfileStore.setState({ profile: null, isLoaded: true });
		mockReplace.mockClear();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("salva o nome, mostra o toast e abre o app", async () => {
		await render(<OnboardingScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("Nome de usuário"),
			"  Arthur ",
		);
		await fireEvent.press(screen.getByText("Começar"));

		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
		expect((await getProfile(mockDb))?.username).toBe("Arthur");
		expect(useProfileStore.getState().profile?.username).toBe("Arthur");
		expect(Toast.show).toHaveBeenCalledWith(
			expect.objectContaining({ type: "success", text2: "Bem-vindo, Arthur!" }),
		);
	});

	test("recusa nome curto, mostra o erro e não salva", async () => {
		await render(<OnboardingScreen />);

		await fireEvent.changeText(screen.getByLabelText("Nome de usuário"), "A");
		await fireEvent.press(screen.getByText("Começar"));

		expect(await screen.findByText("Use pelo menos 2 caracteres")).toBeTruthy();
		expect(mockReplace).not.toHaveBeenCalled();
		expect(await getProfile(mockDb)).toBeNull();
		expect(Toast.show).not.toHaveBeenCalled();
	});

	test("mostra toast de erro quando o banco falha", async () => {
		const failing = jest
			.spyOn(mockDb, "runAsync")
			.mockRejectedValueOnce(new Error("falha"));
		await render(<OnboardingScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("Nome de usuário"),
			"Arthur",
		);
		await fireEvent.press(screen.getByText("Começar"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível salvar o seu nome. Tente novamente.",
				}),
			),
		);
		expect(mockReplace).not.toHaveBeenCalled();
		failing.mockRestore();
	});
});
