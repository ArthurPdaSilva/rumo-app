import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import {
	type ChannelKey,
	type LiveNotification,
	type PlannedNotification,
	POMODORO_ACTION_IDS,
	POMODORO_CATEGORY_PAUSED,
	POMODORO_CATEGORY_RUNNING,
	POMODORO_ID_PREFIX,
	POMODORO_LIVE_KIND,
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
	// Silencioso e sem aviso na tela: só fica na bandeja enquanto o foco corre.
	focusLive: {
		name: "Foco em andamento",
		importance: Notifications.AndroidImportance.LOW,
	},
};

export type PermissionState = "granted" | "denied" | "undetermined";
export type ExactAlarmState = "granted" | "denied" | "unsupported";

/**
 * Com o app aberto o Pomodoro já avisa por toast; o resto aparece normalmente.
 * A notificação fixa do foco divide o prefixo dos avisos, mas é exceção: ela
 * precisa existir na bandeja para continuar lá quando o app for minimizado.
 */
export function configureNotifications(): void {
	Notifications.setNotificationHandler({
		handleNotification: async (notification) => {
			const { identifier, content } = notification.request;
			const isLive = content.data?.kind === POMODORO_LIVE_KIND;
			const show = isLive || !identifier.startsWith(POMODORO_ID_PREFIX);
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

/** Botões da notificação fixa do foco. Rodam sem abrir o app. */
export async function registerPomodoroCategories(): Promise<void> {
	const options = { opensAppToForeground: false };
	await Notifications.setNotificationCategoryAsync(POMODORO_CATEGORY_RUNNING, [
		{ identifier: POMODORO_ACTION_IDS.pause, buttonTitle: "Pausar", options },
		{ identifier: POMODORO_ACTION_IDS.stop, buttonTitle: "Encerrar", options },
	]);
	await Notifications.setNotificationCategoryAsync(POMODORO_CATEGORY_PAUSED, [
		{ identifier: POMODORO_ACTION_IDS.resume, buttonTitle: "Retomar", options },
		{ identifier: POMODORO_ACTION_IDS.stop, buttonTitle: "Encerrar", options },
	]);
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

/**
 * Mostra (ou atualiza, pelo mesmo identificador) a notificação fixa do foco.
 * `sticky` a mantém na bandeja e `autoDismiss: false` impede que tocar nela a feche.
 */
export async function presentLive(live: LiveNotification): Promise<void> {
	await Notifications.scheduleNotificationAsync({
		identifier: live.id,
		content: {
			title: live.title,
			body: live.body,
			sticky: true,
			autoDismiss: false,
			categoryIdentifier: live.categoryId,
			data: { kind: POMODORO_LIVE_KIND },
		},
		trigger: { channelId: live.channel },
	});
}

/** Avisa quando a pessoa toca num botão (ou na própria notificação) com o app vivo. */
export function listenToNotificationActions(
	listener: (actionIdentifier: string) => void,
): () => void {
	const subscription = Notifications.addNotificationResponseReceivedListener(
		(response) => listener(response.actionIdentifier),
	);
	return () => subscription.remove();
}

/**
 * Registra a tarefa que o sistema roda quando um botão é tocado com o app em
 * segundo plano ou fechado. A tarefa em si é definida com o expo-task-manager.
 */
export async function registerNotificationTask(name: string): Promise<void> {
	await Notifications.registerTaskAsync(name);
}

/** Lê o botão tocado do que a tarefa em segundo plano recebe; `null` se não for uma resposta. */
export function actionIdentifierOf(payload: unknown): string | null {
	if (typeof payload !== "object" || payload === null) return null;
	const identifier = (payload as { actionIdentifier?: unknown })
		.actionIdentifier;
	return typeof identifier === "string" ? identifier : null;
}

/** Remove da bandeja as notificações com esses identificadores. */
export async function dismissLive(ids: string[]): Promise<void> {
	for (const id of ids) await Notifications.dismissNotificationAsync(id);
}

/** Com o app à frente o aviso de fim de fase é suprimido, então nada o substitui na bandeja. */
export function isAppInForeground(): boolean {
	return AppState.currentState === "active";
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
