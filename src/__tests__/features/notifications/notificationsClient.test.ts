import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import {
	actionIdentifierOf,
	configureNotifications,
	dismissLive,
	isAppInForeground,
	listenToNotificationActions,
	presentLive,
	registerNotificationTask,
	registerPomodoroCategories,
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
	AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
	setNotificationCategoryAsync: jest.fn().mockResolvedValue(undefined),
	dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
	addNotificationResponseReceivedListener: jest.fn(),
	registerTaskAsync: jest.fn().mockResolvedValue(null),
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

	describe("notificação fixa do foco", () => {
		const live = {
			id: "pomodoro:focus-end",
			channel: "focusLive" as const,
			categoryId: "pomodoro-running",
			title: "Foco",
			body: "Termina às 14:25",
		};

		test("é apresentada na hora, fixa, com botões e sem fechar ao toque", async () => {
			await presentLive(live);

			expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
				identifier: "pomodoro:focus-end",
				content: {
					title: "Foco",
					body: "Termina às 14:25",
					sticky: true,
					autoDismiss: false,
					categoryIdentifier: "pomodoro-running",
					data: { kind: "pomodoroLive" },
				},
				trigger: { channelId: "focusLive" },
			});
		});

		test("os botões não abrem o app: Pausar/Encerrar e Retomar/Encerrar", async () => {
			await registerPomodoroCategories();

			const calls = (
				mocked.setNotificationCategoryAsync as jest.Mock
			).mock.calls.map(([id, actions]) => [
				id,
				actions.map(
					(action: { identifier: string; buttonTitle: string }) =>
						`${action.identifier}:${action.buttonTitle}`,
				),
			]);
			expect(calls).toEqual([
				[
					"pomodoro-running",
					["pomodoro.pause:Pausar", "pomodoro.stop:Encerrar"],
				],
				[
					"pomodoro-paused",
					["pomodoro.resume:Retomar", "pomodoro.stop:Encerrar"],
				],
			]);
			for (const [, actions] of (
				mocked.setNotificationCategoryAsync as jest.Mock
			).mock.calls) {
				for (const action of actions) {
					expect(action.options).toEqual({ opensAppToForeground: false });
				}
			}
		});

		test("dispensa só os identificadores pedidos", async () => {
			await dismissLive(["a", "b"]);
			expect(
				(mocked.dismissNotificationAsync as jest.Mock).mock.calls.map(
					([id]) => id,
				),
			).toEqual(["a", "b"]);
		});

		test("com o app aberto a fixa aparece; o aviso agendado do Pomodoro continua suprimido", async () => {
			configureNotifications();
			const handler = (mocked.setNotificationHandler as jest.Mock).mock
				.calls[0][0].handleNotification;
			const request = (identifier: string, kind: string) => ({
				request: { identifier, content: { data: { kind } } },
			});

			const fixed = await handler(
				request("pomodoro:focus-end", "pomodoroLive"),
			);
			const alert = await handler(
				request("pomodoro:focus-end", "pomodoroFocus"),
			);
			const routine = await handler(request("routine:1:1", "routine"));

			expect(fixed.shouldShowList).toBe(true);
			expect(alert.shouldShowBanner).toBe(false);
			expect(routine.shouldShowBanner).toBe(true);
		});

		test("ouve os botões e devolve uma função para parar de ouvir", () => {
			const remove = jest.fn();
			(
				mocked.addNotificationResponseReceivedListener as jest.Mock
			).mockReturnValue({ remove });
			const listener = jest.fn();

			const stop = listenToNotificationActions(listener);
			const handle = (
				mocked.addNotificationResponseReceivedListener as jest.Mock
			).mock.calls[0][0];
			handle({ actionIdentifier: "pomodoro.pause" });
			stop();

			expect(listener).toHaveBeenCalledWith("pomodoro.pause");
			expect(remove).toHaveBeenCalledTimes(1);
		});

		test("registra a tarefa de segundo plano pelo nome", async () => {
			await registerNotificationTask("TAREFA");
			expect(mocked.registerTaskAsync).toHaveBeenCalledWith("TAREFA");
		});

		test("lê o botão tocado só de uma resposta válida", () => {
			expect(actionIdentifierOf({ actionIdentifier: "pomodoro.stop" })).toBe(
				"pomodoro.stop",
			);
			expect(actionIdentifierOf({ data: { x: 1 } })).toBeNull();
			expect(actionIdentifierOf({ actionIdentifier: 3 })).toBeNull();
			expect(actionIdentifierOf(null)).toBeNull();
			expect(actionIdentifierOf("texto")).toBeNull();
		});

		test("sabe se o app está à frente", () => {
			const original = AppState.currentState;
			Object.defineProperty(AppState, "currentState", {
				value: "active",
				configurable: true,
			});
			expect(isAppInForeground()).toBe(true);
			Object.defineProperty(AppState, "currentState", {
				value: "background",
				configurable: true,
			});
			expect(isAppInForeground()).toBe(false);
			Object.defineProperty(AppState, "currentState", {
				value: original,
				configurable: true,
			});
		});
	});
});
