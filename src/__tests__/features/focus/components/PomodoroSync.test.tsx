import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { PomodoroSync } from "../../../../features/focus/components/PomodoroSync";
import { applyPomodoroAction } from "../../../../features/focus/pomodoroActions";
import { useFocusStore } from "../../../../features/focus/stores/FocusStore";
import { listenToNotificationActions } from "../../../../features/notifications/notificationsClient";

const mockDb = { id: "db" };
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../../../features/focus/pomodoroActions", () => ({
	...jest.requireActual("../../../../features/focus/pomodoroActions"),
	applyPomodoroAction: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../../../features/notifications/notificationsClient", () => ({
	listenToNotificationActions: jest.fn(),
}));

describe("PomodoroSync", () => {
	let restore: jest.Mock;
	let onAppState: (state: string) => void;
	let onAction: (identifier: string) => void;
	const removeAppState = jest.fn();
	const stopListening = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		restore = jest.fn().mockResolvedValue(undefined);
		useFocusStore.setState({ restore });
		jest.spyOn(AppState, "addEventListener").mockImplementation(((
			_type: string,
			listener: (state: string) => void,
		) => {
			onAppState = listener;
			return { remove: removeAppState };
		}) as never);
		(listenToNotificationActions as jest.Mock).mockImplementation(
			(listener) => {
				onAction = listener;
				return stopListening;
			},
		);
	});
	afterEach(() => jest.restoreAllMocks());

	test("relê a fase do banco ao abrir o app", async () => {
		await render(<PomodoroSync />);

		expect(restore).toHaveBeenCalledTimes(1);
		expect(restore).toHaveBeenCalledWith(mockDb);
	});

	test("relê de novo cada vez que o app volta ao primeiro plano, e só então", async () => {
		await render(<PomodoroSync />);
		restore.mockClear();

		await act(async () => onAppState("background"));
		expect(restore).not.toHaveBeenCalled();
		await act(async () => onAppState("active"));
		expect(restore).toHaveBeenCalledTimes(1);
	});

	test("botão tocado com o app vivo: aplica a ação no banco e atualiza a store", async () => {
		await render(<PomodoroSync />);
		restore.mockClear();

		await act(async () => onAction("pomodoro.pause"));

		expect(applyPomodoroAction).toHaveBeenCalledWith(mockDb, "pause");
		expect(restore).toHaveBeenCalledTimes(1);
	});

	test("tocar no corpo da notificação não é uma ação", async () => {
		await render(<PomodoroSync />);

		await act(async () =>
			onAction("expo.modules.notifications.actions.DEFAULT"),
		);

		expect(applyPomodoroAction).not.toHaveBeenCalled();
	});

	test("falha na ação não derruba o app", async () => {
		(applyPomodoroAction as jest.Mock).mockRejectedValueOnce(
			new Error("falhou"),
		);
		await render(<PomodoroSync />);

		await act(async () => onAction("pomodoro.stop"));

		expect(applyPomodoroAction).toHaveBeenCalled();
	});

	test("ao sair, solta os ouvintes", async () => {
		const view = await render(<PomodoroSync />);

		await view.unmount();

		expect(removeAppState).toHaveBeenCalledTimes(1);
		expect(stopListening).toHaveBeenCalledTimes(1);
	});
});
