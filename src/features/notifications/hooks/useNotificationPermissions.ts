import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
	type ExactAlarmState,
	getExactAlarmState,
	getNotificationPermission,
	type PermissionState,
	requestExactAlarm,
} from "@/features/notifications/notificationsClient";

interface PermissionsInfo {
	notifications: PermissionState | null;
	exactAlarm: ExactAlarmState | null;
	refresh: () => Promise<void>;
	askExactAlarm: () => Promise<ExactAlarmState>;
}

/** Estado das permissões, atualizado ao abrir a tela e ao voltar dos ajustes do sistema. */
export function useNotificationPermissions(): PermissionsInfo {
	const [notifications, setNotifications] = useState<PermissionState | null>(
		null,
	);
	const [exactAlarm, setExactAlarm] = useState<ExactAlarmState | null>(null);

	const refresh = useCallback(async () => {
		try {
			const [permission, exact] = await Promise.all([
				getNotificationPermission(),
				getExactAlarmState(),
			]);
			setNotifications(permission);
			setExactAlarm(exact);
		} catch {
			setNotifications(null);
			setExactAlarm(null);
		}
	}, []);

	useEffect(() => {
		refresh();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") refresh();
		});
		return () => subscription.remove();
	}, [refresh]);

	const askExactAlarm = useCallback(async () => {
		const state = await requestExactAlarm();
		setExactAlarm(state);
		return state;
	}, []);

	return { notifications, exactAlarm, refresh, askExactAlarm };
}
