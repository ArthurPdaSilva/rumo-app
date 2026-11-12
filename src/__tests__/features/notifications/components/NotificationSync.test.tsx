import { act, render } from "@testing-library/react-native";
import { NotificationSync } from "../../../../features/notifications/components/NotificationSync";
import { syncNotifications } from "../../../../features/notifications/syncNotifications";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => ({}) }));
jest.mock("../../../../features/notifications/syncNotifications", () => ({
	syncNotifications: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../features/notifications/notificationsClient", () => ({
	configureNotifications: jest.fn(),
	createChannels: jest.fn().mockResolvedValue(undefined),
	registerPomodoroCategories: jest.fn().mockResolvedValue(undefined),
}));

describe("NotificationSync", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});
	afterEach(() => jest.useRealTimers());

	test("sincroniza na abertura e depois que o perfil muda, sem repetir à toa", async () => {
		await render(<NotificationSync />);
		await act(async () => {
			jest.advanceTimersByTime(600);
		});
		expect(syncNotifications).toHaveBeenCalledTimes(1);

		await act(async () => {
			useProfileStore.setState({ isLoaded: true });
			useProfileStore.setState({ isLoaded: false });
			jest.advanceTimersByTime(600);
		});
		expect(syncNotifications).toHaveBeenCalledTimes(2);
	});
});
