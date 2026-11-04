import { migrateDatabase } from "../../../database/client";
import * as client from "../../../features/notifications/notificationsClient";
import {
	resetSyncStateForTests,
	syncNotifications,
} from "../../../features/notifications/syncNotifications";
import { createTestDatabase } from "../../helpers/createTestDatabase";

jest.mock("../../../features/notifications/notificationsClient", () => ({
	createChannels: jest.fn().mockResolvedValue(undefined),
	getNotificationPermission: jest.fn(),
	requestNotificationPermission: jest.fn(),
	replaceAppScheduled: jest.fn().mockResolvedValue(undefined),
}));

const mocked = client as jest.Mocked<typeof client>;
const now = new Date(2026, 10, 4, 14, 15);
let db: ReturnType<typeof createTestDatabase>;

async function seed() {
	await db.execAsync(`
		INSERT INTO profile (id, username) VALUES (1, 'Arthur');
		INSERT INTO routine_blocks (weekdays, start_time, title, reminder_minutes)
			VALUES (2, '09:40', 'Concurso 1', 10);
	`);
}

describe("syncNotifications", () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		resetSyncStateForTests();
		db = createTestDatabase();
		await migrateDatabase(db);
		mocked.getNotificationPermission.mockResolvedValue("granted");
	});

	afterEach(() => db.close());

	test("agenda a mensagem diária e os lembretes lidos do banco", async () => {
		await seed();
		await syncNotifications(db, now);

		const plan = mocked.replaceAppScheduled.mock.calls[0]?.[0] ?? [];
		expect(plan.map((item) => item.id).sort()).toEqual([
			"daily",
			"routine:1:1",
		]);
		expect(mocked.createChannels).toHaveBeenCalled();
	});

	test("sem perfil, limpa os agendamentos e não pede permissão", async () => {
		await syncNotifications(db, now);

		expect(mocked.replaceAppScheduled).toHaveBeenCalledWith([]);
		expect(mocked.getNotificationPermission).not.toHaveBeenCalled();
	});

	test("pede a permissão uma vez quando ainda não foi decidida", async () => {
		await seed();
		mocked.getNotificationPermission.mockResolvedValue("undetermined");
		mocked.requestNotificationPermission.mockResolvedValue("granted");

		await syncNotifications(db, now);
		await syncNotifications(db, now);

		expect(mocked.requestNotificationPermission).toHaveBeenCalledTimes(1);
		expect(mocked.replaceAppScheduled).toHaveBeenCalledTimes(2);
	});

	test("permissão negada: não agenda nada", async () => {
		await seed();
		mocked.getNotificationPermission.mockResolvedValue("denied");

		await syncNotifications(db, now);

		expect(mocked.replaceAppScheduled).toHaveBeenCalledWith([]);
		expect(mocked.requestNotificationPermission).not.toHaveBeenCalled();
	});

	test("sincronizações em sequência não se sobrepõem", async () => {
		await seed();
		const order: string[] = [];
		mocked.replaceAppScheduled.mockImplementation(async () => {
			order.push("start");
			await new Promise((resolve) => setTimeout(resolve, 10));
			order.push("end");
		});

		await Promise.all([syncNotifications(db, now), syncNotifications(db, now)]);

		expect(order).toEqual(["start", "end", "start", "end"]);
	});
});
