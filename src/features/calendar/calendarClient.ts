import * as Calendar from "expo-calendar/legacy";
import type {
	CalendarEventDetails,
	CalendarGateway,
} from "@/features/calendar/calendarSync";

/**
 * Usa a API "legacy" do expo-calendar de propósito: a API nova (ExpoCalendar)
 * não existe no Expo Go, e a legacy funciona nele e no dev build.
 *
 * Único ponto que fala com o expo-calendar. Os eventos são gravados na agenda
 * do aparelho; se a conta Google está sincronizando, o Android os envia ao
 * Google Agenda sozinho. O app não faz nenhuma chamada de rede nem guarda
 * credenciais, o que mantém a regra de funcionar 100% offline.
 */

export type CalendarPermissionState = "granted" | "denied" | "undetermined";

export interface DeviceCalendar {
	id: string;
	title: string;
	/** Conta dona da agenda (no Google, o e-mail). */
	account: string;
	isGoogle: boolean;
	isPrimary: boolean;
}

const GOOGLE_ACCOUNT_TYPE = "com.google";

function toState(response: {
	granted: boolean;
	canAskAgain: boolean;
}): CalendarPermissionState {
	if (response.granted) return "granted";
	return response.canAskAgain ? "undetermined" : "denied";
}

export async function getCalendarPermission(): Promise<CalendarPermissionState> {
	return toState(await Calendar.getCalendarPermissionsAsync());
}

export async function requestCalendarPermission(): Promise<CalendarPermissionState> {
	return toState(await Calendar.requestCalendarPermissionsAsync());
}

/** Agendas onde dá para criar eventos (as somente leitura, como feriados, ficam de fora). */
export async function listWritableCalendars(): Promise<DeviceCalendar[]> {
	const calendars = await Calendar.getCalendarsAsync(
		Calendar.EntityTypes.EVENT,
	);
	return calendars
		.filter((calendar) => calendar.allowsModifications)
		.map((calendar) => ({
			id: calendar.id,
			title: calendar.title,
			account: calendar.source?.name ?? "",
			isGoogle: calendar.source?.type === GOOGLE_ACCOUNT_TYPE,
			isPrimary: calendar.isPrimary === true,
		}));
}

export const calendarGateway: CalendarGateway = {
	async createEvent(calendarId: string, details: CalendarEventDetails) {
		return Calendar.createEventAsync(calendarId, {
			title: details.title,
			notes: details.notes ?? undefined,
			startDate: details.startDate,
			endDate: details.endDate,
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			// Sem alarmes: o próprio Rumo já avisa antes de cada bloco.
			recurrenceRule: details.recurring
				? { frequency: Calendar.Frequency.WEEKLY, interval: 1 }
				: undefined,
		});
	},
	async deleteEvent(eventId: string) {
		await Calendar.deleteEventAsync(eventId);
	},
	async eventExists(eventId: string) {
		try {
			await Calendar.getEventAsync(eventId);
			return true;
		} catch {
			return false;
		}
	},
};
