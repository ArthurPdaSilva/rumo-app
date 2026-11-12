import { migrateDatabase } from "../../../../database/client";
import { setCalendarId } from "../../../../database/repositories/calendarRepository";
import * as client from "../../../../features/calendar/calendarClient";
import { useCalendarStore } from "../../../../features/calendar/stores/CalendarStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

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
const personal = {
	id: "p",
	title: "Pessoal",
	account: "a@gmail.com",
	isGoogle: true,
	isPrimary: false,
};
const primary = {
	...personal,
	id: "main",
	title: "a@gmail.com",
	isPrimary: true,
};
const local = { ...personal, id: "loc", isGoogle: false };

let db: ReturnType<typeof createTestDatabase>;

describe("useCalendarStore", () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		useCalendarStore.getState().reset();
		db = createTestDatabase();
		await migrateDatabase(db);
		mocked.getCalendarPermission.mockResolvedValue("granted");
		mocked.listWritableCalendars.mockResolvedValue([local, personal, primary]);
	});
	afterEach(() => db.close());

	test("sem permissão não lista agendas", async () => {
		mocked.getCalendarPermission.mockResolvedValue("undetermined");

		await useCalendarStore.getState().load(db);

		const state = useCalendarStore.getState();
		expect(state).toMatchObject({
			permission: "undetermined",
			isLoaded: true,
			calendars: [],
		});
		expect(mocked.listWritableCalendars).not.toHaveBeenCalled();
	});

	test("sugere e grava a agenda principal da conta Google", async () => {
		await useCalendarStore.getState().load(db);

		expect(useCalendarStore.getState().calendarId).toBe("main");
		const row = await db.getFirstAsync<{ calendar_id: string }>(
			"SELECT calendar_id FROM app_state WHERE id = 1",
		);
		expect(row?.calendar_id).toBe("main");
	});

	test("mantém a escolha que ainda existe e troca a que sumiu", async () => {
		await setCalendarId(db, "p");
		await useCalendarStore.getState().load(db);
		expect(useCalendarStore.getState().calendarId).toBe("p");

		await setCalendarId(db, "removida");
		await useCalendarStore.getState().load(db);
		expect(useCalendarStore.getState().calendarId).toBe("main");
	});

	test("sem agenda Google, não escolhe nada sozinho", async () => {
		mocked.listWritableCalendars.mockResolvedValue([local]);

		await useCalendarStore.getState().load(db);

		expect(useCalendarStore.getState().calendarId).toBeNull();
	});

	test("pedir permissão concedida recarrega as agendas; negada só guarda o estado", async () => {
		mocked.getCalendarPermission.mockResolvedValue("undetermined");
		mocked.requestCalendarPermission.mockResolvedValueOnce("denied");
		await useCalendarStore.getState().load(db);

		await useCalendarStore.getState().requestPermission(db);
		expect(useCalendarStore.getState()).toMatchObject({
			permission: "denied",
			calendars: [],
		});

		mocked.requestCalendarPermission.mockResolvedValueOnce("granted");
		mocked.getCalendarPermission.mockResolvedValue("granted");
		await useCalendarStore.getState().requestPermission(db);
		expect(useCalendarStore.getState().calendars).toHaveLength(3);
	});

	test("escolher agenda e mudar repetição persistem", async () => {
		await useCalendarStore.getState().load(db);

		await useCalendarStore.getState().selectCalendar(db, "p");
		await useCalendarStore.getState().changeRecurring(db, false);

		expect(useCalendarStore.getState()).toMatchObject({
			calendarId: "p",
			recurring: false,
		});
		useCalendarStore.getState().reset();
		await useCalendarStore.getState().load(db);
		expect(useCalendarStore.getState()).toMatchObject({
			calendarId: "p",
			recurring: false,
		});
	});

	test("sincronizar cria os eventos, conta e libera o estado ocupado; remover zera", async () => {
		const gateway = mocked.calendarGateway as jest.Mocked<
			typeof client.calendarGateway
		>;
		let n = 0;
		gateway.createEvent.mockImplementation(async () => `ev${++n}`);
		gateway.eventExists.mockResolvedValue(true);
		gateway.deleteEvent.mockResolvedValue(undefined);
		await db.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, end_time, title) VALUES (10, '09:00', '10:00', 'X')",
		);
		await useCalendarStore.getState().load(db);

		const result = await useCalendarStore
			.getState()
			.sync(db, new Date(2026, 10, 4, 12));

		expect(result.created).toBe(2);
		expect(useCalendarStore.getState()).toMatchObject({
			eventCount: 2,
			isBusy: false,
		});

		expect(await useCalendarStore.getState().removeAll(db)).toBe(2);
		expect(useCalendarStore.getState().eventCount).toBe(0);
	});

	test("sync com erro libera o estado ocupado", async () => {
		await useCalendarStore.getState().load(db);
		await useCalendarStore.getState().selectCalendar(db, "main");
		await db.execAsync(
			"INSERT INTO routine_blocks (weekdays, start_time, title) VALUES (8, '09:00', 'X')",
		);
		(mocked.calendarGateway.createEvent as jest.Mock).mockRejectedValue(
			new Error("x"),
		);

		await expect(useCalendarStore.getState().sync(db)).rejects.toThrow("x");
		expect(useCalendarStore.getState().isBusy).toBe(false);
	});
});
