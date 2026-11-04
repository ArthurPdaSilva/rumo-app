import {
	cancelPomodoroScheduled,
	getNotificationPermission,
	schedule,
} from "@/features/notifications/notificationsClient";
import { planPomodoroAlerts } from "@/features/notifications/planner";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";

export interface PomodoroAlertTimes {
	focusEndsAt: number;
	breakMinutes: number;
	breakEndsAt: number;
}

export function cancelPomodoroAlerts(): Promise<void> {
	return cancelPomodoroScheduled();
}

/**
 * Agenda o fim do foco e o fim da pausa seguinte ao iniciar o foco, para o
 * aviso chegar mesmo com o app em segundo plano. Sem permissão ou com as
 * notificações desligadas, não agenda nada.
 */
export async function schedulePomodoroAlerts(
	times: PomodoroAlertTimes,
): Promise<void> {
	await cancelPomodoroScheduled();
	const profile = useProfileStore.getState().profile;
	if (!profile?.notificationsEnabled) return;
	if ((await getNotificationPermission()) !== "granted") return;

	for (const planned of planPomodoroAlerts({
		username: profile.username,
		...times,
	})) {
		await schedule(planned);
	}
}
