import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useAddictionStore } from "@/features/addictions/stores/AddictionStore";
import {
	configureNotifications,
	createChannels,
} from "@/features/notifications/notificationsClient";
import { syncNotifications } from "@/features/notifications/syncNotifications";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";

const DEBOUNCE_MS = 500;

/**
 * Sem interface: mantém os agendamentos em dia. Recalcula na abertura, ao
 * voltar para o app e sempre que perfil, vícios ou rotina mudam.
 */
export function NotificationSync() {
	const db = useSQLiteContext();

	useEffect(() => {
		configureNotifications();
		createChannels().catch(() => undefined);
	}, []);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const schedule = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				syncNotifications(db).catch(() => undefined);
			}, DEBOUNCE_MS);
		};

		const unsubscribes = [
			useProfileStore.subscribe(schedule),
			useAddictionStore.subscribe(schedule),
			useRoutineStore.subscribe(schedule),
		];
		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") schedule();
		});
		schedule();

		return () => {
			if (timer) clearTimeout(timer);
			for (const unsubscribe of unsubscribes) unsubscribe();
			appState.remove();
		};
	}, [db]);

	return null;
}
