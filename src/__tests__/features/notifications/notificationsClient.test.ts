import * as Notifications from "expo-notifications";
import {
	replaceAppScheduled,
	schedule,
} from "../../../features/notifications/notificationsClient";
import type { PlannedNotification } from "../../../features/notifications/planner";

jest.mock("expo-notifications", () => ({
	SchedulableTriggerInputTypes: {
		DATE: "date",
		DAILY: "daily",
		WEEKLY: "weekly",
	},
	AndroidImportance: { HIGH: 4, DEFAULT: 3 },
	scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
	getAllScheduledNotificationsAsync: jest.fn(),
	setNotificationHandler: jest.fn(),
	setNotificationChannelAsync: jest.fn(),
	getPermissionsAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

function planned(trigger: PlannedNotification["trigger"]): PlannedNotification {
	return {
		id: "x:1",
		kind: "routine",
		channel: "reminders",
		title: "Rumo",
		body: "texto",
		trigger,
	};
}

describe("notificationsClient", () => {
	beforeEach(() => jest.clearAllMocks());

	test("converte cada gatilho para o formato do expo-notifications", async () => {
		const date = new Date(2026, 10, 8, 10, 0);
		await schedule(planned({ type: "date", date }));
		await schedule(planned({ type: "daily", hour: 8, minute: 30 }));
		await schedule(
			planned({ type: "weekly", weekday: 2, hour: 9, minute: 30 }),
		);

		const triggers = mocked.scheduleNotificationAsync.mock.calls.map(
			([request]) => request.trigger,
		);
		expect(triggers).toEqual([
			{ type: "date", date, channelId: "reminders" },
			{ type: "daily", hour: 8, minute: 30, channelId: "reminders" },
			{
				type: "weekly",
				weekday: 2,
				hour: 9,
				minute: 30,
				channelId: "reminders",
			},
		]);
		expect(mocked.scheduleNotificationAsync.mock.calls[0]?.[0]).toMatchObject({
			identifier: "x:1",
			content: { title: "Rumo", body: "texto", data: { kind: "routine" } },
		});
	});

	test("replaceAppScheduled preserva os avisos do Pomodoro", async () => {
		mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
			{ identifier: "daily" },
			{ identifier: "routine:1:1" },
			{ identifier: "pomodoro:focus-end" },
		] as never);

		await replaceAppScheduled([planned({ type: "daily", hour: 8, minute: 0 })]);

		expect(
			mocked.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id),
		).toEqual(["daily", "routine:1:1"]);
		expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
	});
});
