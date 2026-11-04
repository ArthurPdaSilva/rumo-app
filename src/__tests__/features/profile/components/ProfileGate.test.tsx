import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { ProfileGate } from "../../../../features/profile/components/ProfileGate";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
	const { Text: MockText } = require("react-native");
	const React = require("react");
	return {
		Redirect: ({ href }: { href: string }) =>
			React.createElement(MockText, null, `redirect:${href}`),
	};
});

describe("ProfileGate", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useProfileStore.setState({ profile: null, isLoaded: false });
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("leva ao onboarding quando ainda não há perfil", async () => {
		await render(
			<ProfileGate>
				<Text>conteúdo</Text>
			</ProfileGate>,
		);

		expect(await screen.findByText("redirect:/onboarding")).toBeTruthy();
		expect(screen.queryByText("conteúdo")).toBeNull();
	});

	test("mostra o conteúdo quando o perfil existe", async () => {
		await useProfileStore
			.getState()
			.saveDetails(mockDb, { username: "Arthur" });
		useProfileStore.setState({ profile: null, isLoaded: false });

		await render(
			<ProfileGate>
				<Text>conteúdo</Text>
			</ProfileGate>,
		);

		expect(await screen.findByText("conteúdo")).toBeTruthy();
		expect(screen.queryByText("redirect:/onboarding")).toBeNull();
	});

	test("avisa com toast de erro quando não consegue carregar o perfil", async () => {
		jest
			.spyOn(mockDb, "getFirstAsync")
			.mockRejectedValueOnce(new Error("falha"));

		await render(
			<ProfileGate>
				<Text>conteúdo</Text>
			</ProfileGate>,
		);

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível carregar o seu perfil.",
				}),
			),
		);
		expect(screen.queryByText("conteúdo")).toBeNull();
	});
});
