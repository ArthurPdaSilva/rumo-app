import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import Toast from "react-native-toast-message";
import { migrateDatabase } from "../../../../database/client";
import * as client from "../../../../features/calendar/calendarClient";
import {
	CalendarSyncScreen,
	describeSync,
} from "../../../../features/calendar/screens/CalendarSyncScreen";
import { useCalendarStore } from "../../../../features/calendar/stores/CalendarStore";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

let mockDb: ReturnType<typeof createTestDatabase>;

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../../../features/calendar/calendarClient", () => ({
	getCalendarPermission: jest.fn(),
	requestCalendarPermission: jest.fn(),
	listWritableCalendars: jest.fn(),
	calendarGateway: {
		createEvent: jest.fn(),
		deleteEvent: jest.fn(),
		eventExists: jest.fn(),
	},
}));

const mocked = client as jest.Mocked<typeof client>;
const gateway = client.calendarGateway as unknown as {
	createEvent: jest.Mock;
	deleteEvent: jest.Mock;
	eventExists: jest.Mock;
};
const main = {
	id: "main",
	title: "Principal",
	account: "a@gmail.com",
	isGoogle: true,
	isPrimary: true,
};
const other = { ...main, id: "o", title: "Estudos", isPrimary: false };

function lastToast() {
	const calls = (Toast.show as jest.Mock).mock.calls;
	return calls[calls.length - 1]?.[0];
}

describe("describeSync", () => {
	test("lista só o que aconteceu", () => {
		expect(
			describeSync({ created: 3, updated: 1, removed: 2, unchanged: 0 }),
		).toBe("Agenda atualizada: 3 novos, 1 atualizado e 2 removidos.");
		expect(
			describeSync({ created: 1, updated: 0, removed: 0, unchanged: 4 }),
		).toBe("Agenda atualizada: 1 novo.");
		expect(
			describeSync({ created: 0, updated: 0, removed: 0, unchanged: 4 }),
		).toBe("A agenda já estava em dia.");
	});
});

describe("CalendarSyncScreen", () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		useCalendarStore.getState().reset();
		useRoutineStore.setState({ isLoaded: false, blocks: [] });
		mockDb = createTestDatabase();
		await migrateDatabase(mockDb);
		mocked.getCalendarPermission.mockResolvedValue("granted");
		mocked.listWritableCalendars.mockResolvedValue([main, other]);
	});
	afterEach(() => mockDb.close());

	test("pede permissão quando ainda não foi dada e avisa por toast", async () => {
		mocked.getCalendarPermission.mockResolvedValue("undetermined");
		mocked.requestCalendarPermission.mockImplementation(async () => {
			mocked.getCalendarPermission.mockResolvedValue("granted");
			return "granted";
		});
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Permitir acesso à agenda"));

		await waitFor(() =>
			expect(lastToast()).toMatchObject({ text2: "Acesso à agenda liberado." }),
		);
		expect(await screen.findByText("Em qual agenda?")).toBeTruthy();
	});

	test("permissão negada avisa por toast", async () => {
		mocked.getCalendarPermission.mockResolvedValue("undetermined");
		mocked.requestCalendarPermission.mockResolvedValue("denied");
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Permitir acesso à agenda"));

		await waitFor(() => expect(lastToast()?.type).toBe("info"));
	});

	test("bloqueada nos ajustes, abre os ajustes do aparelho", async () => {
		mocked.getCalendarPermission.mockResolvedValue("denied");
		const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Abrir ajustes do aparelho"));

		await waitFor(() => expect(open).toHaveBeenCalled());
	});

	test("escolher agenda e alternar repetição mostram toast", async () => {
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Estudos · a@gmail.com"));
		await waitFor(() =>
			expect(lastToast()).toMatchObject({ text2: "Agenda escolhida." }),
		);
		expect(useCalendarStore.getState().calendarId).toBe("o");

		await fireEvent(
			screen.getByLabelText("Repetir toda semana"),
			"valueChange",
			false,
		);
		await waitFor(() =>
			expect(lastToast()).toMatchObject({ text2: "Só a semana atual." }),
		);
		expect(useCalendarStore.getState().recurring).toBe(false);
	});

	test("sincronizar cria eventos e resume por toast", async () => {
		let n = 0;
		gateway.createEvent.mockImplementation(async () => `e${++n}`);
		await mockDb.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, end_time, title) VALUES (8, '09:00', '10:00', 'Concurso')",
		);
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Sincronizar rotina"));

		await waitFor(() =>
			expect(lastToast()).toMatchObject({
				text2: "Agenda atualizada: 1 novo.",
			}),
		);
		expect(await screen.findByText(/1 evento criado/)).toBeTruthy();
	});

	test("falha ao sincronizar avisa por toast de erro", async () => {
		gateway.createEvent.mockRejectedValue(new Error("x"));
		await mockDb.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, title) VALUES (8, '09:00', 'Concurso')",
		);
		await render(<CalendarSyncScreen />);

		await fireEvent.press(await screen.findByText("Sincronizar rotina"));

		await waitFor(() => expect(lastToast()?.type).toBe("error"));
	});

	test("remover pede confirmação, apaga e avisa por toast", async () => {
		let n = 0;
		gateway.createEvent.mockImplementation(async () => `e${++n}`);
		gateway.deleteEvent.mockResolvedValue(undefined);
		gateway.eventExists.mockResolvedValue(true);
		await mockDb.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, end_time, title) VALUES (8, '09:00', '10:00', 'Concurso')",
		);
		await render(<CalendarSyncScreen />);
		await fireEvent.press(await screen.findByText("Sincronizar rotina"));
		await fireEvent.press(await screen.findByText("Remover eventos do Rumo"));

		await fireEvent.press(await screen.findByText("Remover"));

		await waitFor(() =>
			expect(lastToast()).toMatchObject({
				text2: "1 evento removido da agenda.",
			}),
		);
		expect(gateway.deleteEvent).toHaveBeenCalledTimes(1);
	});

	test("manter na confirmação não apaga nada", async () => {
		let n = 0;
		gateway.createEvent.mockImplementation(async () => `e${++n}`);
		await mockDb.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, end_time, title) VALUES (8, '09:00', '10:00', 'Concurso')",
		);
		await render(<CalendarSyncScreen />);
		await fireEvent.press(await screen.findByText("Sincronizar rotina"));
		await fireEvent.press(await screen.findByText("Remover eventos do Rumo"));

		await fireEvent.press(await screen.findByText("Manter"));

		expect(gateway.deleteEvent).not.toHaveBeenCalled();
	});

	test("sem agendas editáveis explica o que fazer", async () => {
		mocked.listWritableCalendars.mockResolvedValue([]);
		await render(<CalendarSyncScreen />);

		expect(await screen.findByText(/Nenhuma agenda editável/)).toBeTruthy();
	});
});
