import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import {
	applyPomodoroAction,
	parsePomodoroAction,
} from "@/features/focus/pomodoroActions";
import { useFocusStore } from "@/features/focus/stores/FocusStore";
import { listenToNotificationActions } from "@/features/notifications/notificationsClient";

/**
 * Sem interface: mantém a store do foco igual ao banco. Relê a fase ao abrir o
 * app e a cada volta do segundo plano, porque ela pode ter terminado ou sido
 * pausada pelos botões da notificação enquanto o app estava parado. Também
 * trata os botões quando o app está vivo em segundo plano; a mesma ação pode
 * chegar também pela tarefa do sistema, e aplicar duas vezes não muda nada.
 */
export function PomodoroSync() {
	const db = useSQLiteContext();

	useEffect(() => {
		const restore = () => {
			useFocusStore
				.getState()
				.restore(db)
				.catch(() => undefined);
		};

		restore();
		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") restore();
		});
		const stopListening = listenToNotificationActions((identifier) => {
			const action = parsePomodoroAction(identifier);
			if (!action) return;
			applyPomodoroAction(db, action)
				.then(restore)
				.catch(() => undefined);
		});

		return () => {
			appState.remove();
			stopListening();
		};
	}, [db]);

	return null;
}
