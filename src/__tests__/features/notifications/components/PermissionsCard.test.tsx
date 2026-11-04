import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import { PermissionsCard } from "../../../../features/notifications/components/PermissionsCard";
import * as client from "../../../../features/notifications/notificationsClient";

jest.mock("../../../../features/notifications/notificationsClient", () => ({
	getNotificationPermission: jest.fn(),
	getExactAlarmState: jest.fn(),
	requestExactAlarm: jest.fn(),
}));

const mocked = client as jest.Mocked<typeof client>;

describe("PermissionsCard", () => {
	beforeEach(() => jest.clearAllMocks());

	test("não mostra nada quando está tudo liberado", async () => {
		mocked.getNotificationPermission.mockResolvedValue("granted");
		mocked.getExactAlarmState.mockResolvedValue("granted");
		await render(<PermissionsCard />);

		await waitFor(() => expect(mocked.getExactAlarmState).toHaveBeenCalled());
		expect(screen.queryByText("Permitir horário exato")).toBeNull();
		expect(screen.queryByText("Abrir ajustes do aparelho")).toBeNull();
	});

	test("alarme exato negado: explica e leva aos ajustes do sistema", async () => {
		mocked.getNotificationPermission.mockResolvedValue("granted");
		mocked.getExactAlarmState.mockResolvedValue("denied");
		mocked.requestExactAlarm.mockResolvedValue("granted");
		await render(<PermissionsCard />);

		await fireEvent.press(await screen.findByText("Permitir horário exato"));

		expect(mocked.requestExactAlarm).toHaveBeenCalled();
		await waitFor(() =>
			expect(screen.queryByText("Permitir horário exato")).toBeNull(),
		);
	});

	test("notificações bloqueadas: abre os ajustes do aparelho", async () => {
		mocked.getNotificationPermission.mockResolvedValue("denied");
		mocked.getExactAlarmState.mockResolvedValue("granted");
		const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
		await render(<PermissionsCard />);

		await fireEvent.press(await screen.findByText("Abrir ajustes do aparelho"));

		expect(open).toHaveBeenCalled();
	});
});
