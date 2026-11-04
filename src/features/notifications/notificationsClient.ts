import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
	type ChannelKey,
	type PlannedNotification,
	POMODORO_ID_PREFIX,
} from "@/features/notifications/planner";

/**
 * Único ponto que fala com o expo-notifications. O resto do app trabalha com
 * `PlannedNotification`, o que mantém o planejamento testável sem o módulo nativo.
 */

const CHANNELS: Record<ChannelKey, { name: string; importance: number }> = {
	reminders: {
		name: "Lembretes da rotina",
		importance: Notifications.AndroidImportance.HIGH,
	},
	support: {
		name: "Marcos e mensagem diária",
		importance: Notifications.AndroidImportance.DEFAULT,
	},
	focus: {
		name: "Foco e pausas",
		importance: Notifications.AndroidImportance.HIGH,
	},
};

export type PermissionState = "granted" | "denied" | "undetermined";
export type ExactAlarmState = "granted" | "denied" | "unsupported";

/** Com o app aberto o Pomodoro já avisa por toast; o resto aparece normalmente. */
export function configureNotifications(): void {
	Notifications.setNotificationHandler({
		handleNotification: async (notification) => {
			const id = notification.request.identifier;
			const show = !id.startsWith(POMODORO_ID_PREFIX);
			return {
				shouldShowBanner: show,
				shouldShowList: show,
				shouldPlaySound: false,
				shouldSetBadge: false,
			};
		},
	});
}

export async function createChannels(): Promise<void> {
	if (Platform.OS !== "android") return;
	for (const [id, channel] of Object.entries(CHANNELS)) {
		await Notifications.setNotificationChannelAsync(id, {
			name: channel.name,
			importance: channel.importance,
		});
	}
}

export async function getNotificationPermission(): Promise<PermissionState> {
	const status = await Notifications.getPermissionsAsync();
	if (status.granted) return "granted";
	return status.canAskAgain ? "undetermined" : "denied";
}

export async function requestNotificationPermission(): Promise<PermissionState> {
	const status = await Notifications.requestPermissionsAsync();
	if (status.granted) return "granted";
	return status.canAskAgain ? "undetermined" : "denied";
}

export async function getExactAlarmState(): Promise<ExactAlarmState> {
	if (Platform.OS !== "android") return "unsupported";
	try {
		const status = await Notifications.getExactAlarmPermissionsAsync();
		return status.granted ? "granted" : "denied";
	} catch {
		return "unsupported";
	}
}

/** Abre os ajustes do sistema; ao voltar, devolve o estado atual. */
export async function requestExactAlarm(): Promise<ExactAlarmState> {
	if (Platform.OS !== "android") return "unsupported";
	try {
		const status = await Notifications.requestExactAlarmPermissionsAsync();
		return status.granted ? "granted" : "denied";
	} catch {
		return "unsupported";
	}
}

function toTrigger(
	planned: PlannedNotification,
): Notifications.NotificationTriggerInput {
	const channelId = planned.channel;
	const { trigger } = planned;
	switch (trigger.type) {
		case "date":
			return {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: trigger.date,
				channelId,
			};
		case "daily":
			return {
				type: Notifications.SchedulableTriggerInputTypes.DAILY,
				hour: trigger.hour,
				minute: trigger.minute,
				channelId,
			};
		case "weekly":
			return {
				type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
				weekday: trigger.weekday,
				hour: trigger.hour,
				minute: trigger.minute,
				channelId,
			};
	}
}

export async function schedule(planned: PlannedNotification): Promise<void> {
	await Notifications.scheduleNotificationAsync({
		identifier: planned.id,
		content: {
			title: planned.title,
			body: planned.body,
			data: { kind: planned.kind },
		},
		trigger: toTrigger(planned),
	});
}

async function cancelWhere(
	shouldCancel: (identifier: string) => boolean,
): Promise<void> {
	const scheduled = await Notifications.getAllScheduledNotificationsAsync();
	for (const item of scheduled) {
		if (shouldCancel(item.identifier)) {
			await Notifications.cancelScheduledNotificationAsync(item.identifier);
		}
	}
}

export function cancelPomodoroScheduled(): Promise<void> {
	return cancelWhere((id) => id.startsWith(POMODORO_ID_PREFIX));
}

/** Troca tudo o que está agendado, exceto os avisos do Pomodoro em andamento. */
export async function replaceAppScheduled(
	plan: PlannedNotification[],
): Promise<void> {
	await cancelWhere((id) => !id.startsWith(POMODORO_ID_PREFIX));
	for (const planned of plan) await schedule(planned);
}
