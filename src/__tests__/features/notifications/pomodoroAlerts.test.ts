import * as client from "../../../features/notifications/notificationsClient";
import {
	cancelPomodoroAlerts,
	schedulePomodoroAlerts,
} from "../../../features/notifications/pomodoroAlerts";
import { useProfileStore } from "../../../features/profile/stores/ProfileStore";

jest.mock("../../../features/notifications/notificationsClient", () => ({
	cancelPomodoroScheduled: jest.fn().mockResolvedValue(undefined),
	getNotificationPermission: jest.fn(),
	schedule: jest.fn().mockResolvedValue(undefined),
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
});
