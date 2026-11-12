import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { getProfile } from "../../../../database/repositories/profileRepository";
import { ProfileScreen } from "../../../../features/profile/screens/ProfileScreen";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;

const mockPush = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

describe("ProfileScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useProfileStore.setState({ profile: null, isLoaded: true });
		await useProfileStore
			.getState()
			.saveDetails(mockDb, { username: "Arthur" });
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("mostra o nome e o horário atuais", async () => {
		await render(<ProfileScreen />);

		expect(screen.getByText("Olá, Arthur")).toBeTruthy();
		expect(screen.getByLabelText("Nome de usuário").props.value).toBe("Arthur");
		expect(
			screen.getByLabelText("Horário da mensagem diária").props.value,
		).toBe("08:30");
	});

	test("salva nome e horário e mostra o toast de sucesso", async () => {
		await render(<ProfileScreen />);

		await fireEvent.changeText(screen.getByLabelText("Nome de usuário"), "Art");
		await fireEvent.changeText(
			screen.getByLabelText("Horário da mensagem diária"),
			"07:45",
		);
		await fireEvent.press(screen.getByText("Salvar"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Perfil atualizado.",
				}),
			),
		);
		expect(await getProfile(mockDb)).toMatchObject({
			username: "Art",
			dailyMessageTime: "07:45",
		});
	});

	test("recusa horário inválido sem salvar", async () => {
		await render(<ProfileScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("Horário da mensagem diária"),
			"25:00",
		);
		await fireEvent.press(screen.getByText("Salvar"));

		expect(
			await screen.findByText("Use o formato HH:MM, como 08:30"),
		).toBeTruthy();
		expect(Toast.show).not.toHaveBeenCalled();
		expect((await getProfile(mockDb))?.dailyMessageTime).toBe("08:30");
	});

	test("desativa as notificações e avisa com toast", async () => {
		await render(<ProfileScreen />);

		await fireEvent(
			screen.getByLabelText("Notificações"),
			"valueChange",
			false,
		);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Notificações desativadas.",
				}),
			),
		);
		expect((await getProfile(mockDb))?.notificationsEnabled).toBe(false);
	});

	test("ativa o modo discreto e avisa com toast", async () => {
		await render(<ProfileScreen />);

		await fireEvent(
			screen.getByLabelText("Modo discreto"),
			"valueChange",
			true,
		);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Modo discreto ativado.",
				}),
			),
		);
		expect((await getProfile(mockDb))?.discreetMode).toBe(true);
	});

	test("mostra toast de erro quando não consegue salvar a preferência", async () => {
		const failing = jest
			.spyOn(mockDb, "runAsync")
			.mockRejectedValueOnce(new Error("falha"));
		await render(<ProfileScreen />);

		await fireEvent(
			screen.getByLabelText("Notificações"),
			"valueChange",
			false,
		);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível alterar as notificações.",
				}),
			),
		);
		expect((await getProfile(mockDb))?.notificationsEnabled).toBe(true);
		failing.mockRestore();
	});

	test("o botão abre a tela de importação e backup", async () => {
		await render(<ProfileScreen />);

		await fireEvent.press(screen.getByText("Abrir importação e backup"));

		expect(mockPush).toHaveBeenCalledWith("/data");
	});

	test("o botão abre a integração com a agenda", async () => {
		await render(<ProfileScreen />);

		await fireEvent.press(screen.getByText("Abrir integração com a agenda"));

		expect(mockPush).toHaveBeenCalledWith("/calendar");
	});
});
