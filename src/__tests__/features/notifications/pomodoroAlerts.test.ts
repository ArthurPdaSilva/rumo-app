import * as client from "../../../features/notifications/notificationsClient";
import {
	cancelPomodoroAlerts,
	hidePomodoroLive,
	schedulePomodoroAlerts,
	settlePomodoroLive,
	showPomodoroLive,
} from "../../../features/notifications/pomodoroAlerts";
import { useProfileStore } from "../../../features/profile/stores/ProfileStore";

jest.mock("../../../features/notifications/notificationsClient", () => ({
	cancelPomodoroScheduled: jest.fn().mockResolvedValue(undefined),
	getNotificationPermission: jest.fn(),
	schedule: jest.fn().mockResolvedValue(undefined),
	presentLive: jest.fn().mockResolvedValue(undefined),
	dismissLive: jest.fn().mockResolvedValue(undefined),
	isAppInForeground: jest.fn(),
}));

const mocked = client as jest.Mocked<typeof client>;
const times = { focusEndsAt: 1000, breakMinutes: 5, breakEndsAt: 2000 };

function setProfile(notificationsEnabled: boolean) {
	useProfileStore.setState({
		profile: {
			username: "Arthur",
			notificationsEnabled,
			dailyMessageTime: "08:30",
			discreetMode: false,
		},
	});
}

describe("pomodoroAlerts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mocked.getNotificationPermission.mockResolvedValue("granted");
		setProfile(true);
	});

	test("agenda fim do foco e fim da pausa, trocando os anteriores", async () => {
		await schedulePomodoroAlerts(times);

		expect(mocked.cancelPomodoroScheduled).toHaveBeenCalledTimes(1);
		expect(mocked.schedule.mock.calls.map(([item]) => item.id)).toEqual([
			"pomodoro:focus-end",
			"pomodoro:break-end",
		]);
	});

	test("notificações desligadas ou sem permissão: não agenda", async () => {
		setProfile(false);
		await schedulePomodoroAlerts(times);
		setProfile(true);
		mocked.getNotificationPermission.mockResolvedValue("denied");
		await schedulePomodoroAlerts(times);

		expect(mocked.schedule).not.toHaveBeenCalled();
	});

	test("cancelar remove só os avisos do Pomodoro", async () => {
		await cancelPomodoroAlerts();

		expect(mocked.cancelPomodoroScheduled).toHaveBeenCalled();
	});

	test("retomar uma pausa em curso agenda só o fim da pausa", async () => {
		await schedulePomodoroAlerts({
			focusEndsAt: null,
			breakMinutes: 0,
			breakEndsAt: 2000,
		});

		expect(mocked.schedule.mock.calls.map(([item]) => item.id)).toEqual([
			"pomodoro:break-end",
		]);
	});

	test("usa o perfil recebido quando a store está vazia (ação com o app fechado)", async () => {
		useProfileStore.setState({ profile: null });
		await schedulePomodoroAlerts(times, {
			username: "Arthur",
			notificationsEnabled: true,
			dailyMessageTime: "08:30",
			discreetMode: false,
		});

		expect(mocked.schedule).toHaveBeenCalledTimes(2);
	});

	describe("notificação fixa", () => {
		const input = {
			kind: "focus" as const,
			activity: "Português",
			paused: false,
			endsAtMs: new Date(2026, 10, 4, 14, 25).getTime(),
			remainingMs: 0,
		};

		test("mostra a notificação com o texto da fase", async () => {
			await showPomodoroLive(input);

			expect(mocked.presentLive).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "pomodoro:focus-end",
					title: "Foco · Português",
					body: "Termina às 14:25",
				}),
			);
		});

		test("notificações desligadas ou sem permissão: não mostra nada", async () => {
			setProfile(false);
			await showPomodoroLive(input);
			setProfile(true);
			mocked.getNotificationPermission.mockResolvedValue("denied");
			await showPomodoroLive(input);

			expect(mocked.presentLive).not.toHaveBeenCalled();
		});

		test("encerrar tira a notificação de qualquer fase", async () => {
			await hidePomodoroLive();

			expect(mocked.dismissLive).toHaveBeenCalledWith([
				"pomodoro:focus-end",
				"pomodoro:break-end",
			]);
		});

		test("fim natural com o app à frente: dispensa a fixa daquela fase", async () => {
			mocked.isAppInForeground.mockReturnValue(true);
			await settlePomodoroLive("focus");
			await settlePomodoroLive("longBreak");

			expect(mocked.dismissLive.mock.calls).toEqual([
				[["pomodoro:focus-end"]],
				[["pomodoro:break-end"]],
			]);
		});

		test("fim natural em segundo plano: não apaga o aviso que já a substituiu", async () => {
			mocked.isAppInForeground.mockReturnValue(false);
			await settlePomodoroLive("focus");

			expect(mocked.dismissLive).not.toHaveBeenCalled();
		});
	});
});
