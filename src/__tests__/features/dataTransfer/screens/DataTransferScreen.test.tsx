import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import { pickRumoFile } from "../../../../features/dataTransfer/pickRumoFile";
import { InvalidRumoFileError } from "../../../../features/dataTransfer/rumoFile";
import { DataTransferScreen } from "../../../../features/dataTransfer/screens/DataTransferScreen";
import { shareBackup } from "../../../../features/dataTransfer/shareBackup";
import { useDataTransferStore } from "../../../../features/dataTransfer/stores/DataTransferStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../../../features/dataTransfer/pickRumoFile", () => ({
	pickRumoFile: jest.fn(),
}));
jest.mock("../../../../features/dataTransfer/shareBackup", () => ({
	shareBackup: jest.fn(),
}));
jest.mock("../../../../features/dataTransfer/expoRumoFile", () => ({
	openRumoFileWithExpo: (bytes: Uint8Array) =>
		require("../../../helpers/createTestDatabase").openTestRumoFile(bytes),
}));

const pick = pickRumoFile as jest.Mock;
const share = shareBackup as jest.Mock;
const seed = () => ({
	name: "rumo-seed.db",
	bytes: new Uint8Array(
		readFileSync(join(__dirname, "../../../../../seed/rumo-seed.db")),
	),
});

jest.setTimeout(20000);

describe("DataTransferScreen", () => {
	beforeEach(async () => {
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		useDataTransferStore.setState({ preview: null, pending: null });
		pick.mockReset();
		share.mockReset();
		(Toast.show as jest.Mock).mockClear();
	});

	afterEach(() => mockDb.close());

	test("escolhe o seed, mostra o preview e importa direto quando não há nada a substituir", async () => {
		pick.mockResolvedValue(seed());
		await render(<DataTransferScreen />);

		await fireEvent.press(screen.getByText("Escolher arquivo .db"));
		expect(await screen.findByText("rumo-seed.db")).toBeTruthy();
		expect(screen.getByText("Blocos de rotina: 59")).toBeTruthy();
		expect(screen.getByText("Tarefas: 80")).toBeTruthy();
		expect(screen.getByText("Metas semanais: 16")).toBeTruthy();

		await fireEvent.press(screen.getByText("Importar"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Importação concluída.",
				}),
			),
		);
		const count = await mockDb.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM tasks",
		);
		expect(count?.total).toBe(80);
	});

	test("pede confirmação quando vai substituir dados existentes", async () => {
		await mockDb.runAsync(
			"INSERT INTO tasks (section, title) VALUES ('A', 'velha')",
		);
		pick.mockResolvedValue(seed());
		await render(<DataTransferScreen />);
		await fireEvent.press(screen.getByText("Escolher arquivo .db"));
		await screen.findByText("Tarefas: 80 (substitui 1)");

		await fireEvent.press(screen.getByText("Importar"));
		expect(screen.getByText("Substituir os dados atuais?")).toBeTruthy();
		expect(Toast.show).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("Substituir"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({ type: "success" }),
			),
		);
		const count = await mockDb.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM tasks",
		);
		expect(count?.total).toBe(80);
	});

	test("cancelar o preview não grava nada", async () => {
		pick.mockResolvedValue(seed());
		await render(<DataTransferScreen />);
		await fireEvent.press(screen.getByText("Escolher arquivo .db"));
		await screen.findByText("rumo-seed.db");

		await fireEvent.press(screen.getByText("Cancelar"));

		expect(screen.getByText("Escolher arquivo .db")).toBeTruthy();
		const count = await mockDb.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM tasks",
		);
		expect(count?.total).toBe(0);
	});

	test("avisa quando o arquivo não é um .db do Rumo", async () => {
		pick.mockResolvedValue({
			name: "foto.db",
			bytes: new TextEncoder().encode("nada"),
		});
		await render(<DataTransferScreen />);

		await fireEvent.press(screen.getByText("Escolher arquivo .db"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Este arquivo não é um .db do Rumo.",
				}),
			),
		);
		expect(new InvalidRumoFileError()).toBeInstanceOf(Error);
	});

	test("cancelar o seletor não mostra nada", async () => {
		pick.mockResolvedValue(null);
		await render(<DataTransferScreen />);

		await fireEvent.press(screen.getByText("Escolher arquivo .db"));

		expect(Toast.show).not.toHaveBeenCalled();
		expect(screen.getByText("Escolher arquivo .db")).toBeTruthy();
	});

	test("faz backup com o conteúdo do banco e avisa", async () => {
		await mockDb.runAsync(
			"INSERT INTO profile (id, username) VALUES (1, 'Arthur')",
		);
		share.mockResolvedValue("rumo-backup.db");
		await render(<DataTransferScreen />);

		await fireEvent.press(screen.getByText("Fazer backup"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "success",
					text2: "Backup pronto. Escolha onde salvar.",
				}),
			),
		);
		const bytes = share.mock.calls[0][0] as Uint8Array;
		expect(bytes.byteLength).toBeGreaterThan(0);
		expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe(
			"SQLite format 3",
		);
	});

	test("mostra erro se o backup falhar", async () => {
		share.mockRejectedValue(new Error("falha"));
		await render(<DataTransferScreen />);

		await fireEvent.press(screen.getByText("Fazer backup"));

		await waitFor(() =>
			expect(Toast.show).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error",
					text2: "Não foi possível criar o backup.",
				}),
			),
		);
	});
});
