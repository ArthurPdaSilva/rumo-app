import {
	cancelPomodoroScheduled,
	dismissLive,
	getNotificationPermission,
	isAppInForeground,
	presentLive,
	schedule,
} from "@/features/notifications/notificationsClient";
import {
	planPomodoroAlerts,
	planPomodoroLive,
	type PomodoroLiveInput,
	pomodoroLiveId,
} from "@/features/notifications/planner";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";
import type { PomodoroPhaseKind, Profile } from "@/types";

export interface PomodoroAlertTimes {
	/** `null` quando só falta o fim da pausa (retomar uma pausa em curso). */
	focusEndsAt: number | null;
	breakMinutes: number;
	breakEndsAt: number;
}

/**
 * Perfil usado nos avisos. Com o app aberto vem da store; num contexto sem
 * interface (ação da notificação com o app fechado) quem chama o lê do banco
 * e passa aqui, porque a store está vazia.
 */
function resolveProfile(profile?: Profile | null): Profile | null {
	return profile === undefined ? useProfileStore.getState().profile : profile;
}

async function canNotify(profile: Profile | null): Promise<boolean> {
	if (!profile?.notificationsEnabled) return false;
	return (await getNotificationPermission()) === "granted";
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
	profile?: Profile | null,
): Promise<void> {
	await cancelPomodoroScheduled();
	const current = resolveProfile(profile);
	if (!current || !(await canNotify(current))) return;

	for (const planned of planPomodoroAlerts({
		username: current.username,
		...times,
	})) {
		await schedule(planned);
	}
}

/**
 * Mostra ou atualiza a notificação fixa do foco (com Pausar/Retomar e Encerrar).
 * Deve ser chamada antes de `schedulePomodoroAlerts`: ela divide o identificador
 * do aviso de fim, e agendar depois garante que o aviso continua valendo.
 */
export async function showPomodoroLive(
	input: PomodoroLiveInput,
	profile?: Profile | null,
): Promise<void> {
	if (!(await canNotify(resolveProfile(profile)))) return;
	await presentLive(planPomodoroLive(input));
}

/** Encerramento explícito (parar, cancelar, pular): tira a notificação de qualquer fase. */
export async function hidePomodoroLive(): Promise<void> {
	await dismissLive([pomodoroLiveId("focus"), pomodoroLiveId("break")]);
}

/**
 * Fim natural de uma fase. Em segundo plano o aviso de fim já substituiu a
 * notificação fixa (mesmo identificador) e dispensá-la apagaria o aviso que
 * a pessoa precisa ver; com o app à frente o aviso é suprimido, então a fixa
 * ficaria parada e precisa sair.
 */
export async function settlePomodoroLive(
	kind: PomodoroPhaseKind,
): Promise<void> {
	if (!isAppInForeground()) return;
	await dismissLive([pomodoroLiveId(kind === "focus" ? "focus" : "break")]);
}
