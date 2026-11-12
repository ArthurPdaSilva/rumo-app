import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	getCalendarSettings,
	listCalendarEventRows,
	setCalendarId,
	setCalendarRecurring,
} from "@/database/repositories/calendarRepository";
import {
	type CalendarPermissionState,
	calendarGateway,
	type DeviceCalendar,
	getCalendarPermission,
	listWritableCalendars,
	requestCalendarPermission,
} from "@/features/calendar/calendarClient";
import {
	removeRoutineEvents,
	type SyncResult,
	syncRoutineToCalendar,
} from "@/features/calendar/calendarSync";

interface CalendarState {
	permission: CalendarPermissionState | null;
	calendars: DeviceCalendar[];
	calendarId: string | null;
	recurring: boolean;
	/** Quantos eventos do Rumo existem hoje na agenda. */
	eventCount: number;
	isLoaded: boolean;
	isBusy: boolean;
	load: (db: Database) => Promise<void>;
	requestPermission: (db: Database) => Promise<CalendarPermissionState>;
	selectCalendar: (db: Database, calendarId: string) => Promise<void>;
	changeRecurring: (db: Database, recurring: boolean) => Promise<void>;
	sync: (db: Database, now?: Date) => Promise<SyncResult>;
	removeAll: (db: Database) => Promise<number>;
	reset: () => void;
}

const initialState = {
	permission: null,
	calendars: [],
	calendarId: null,
	recurring: true,
	eventCount: 0,
	isLoaded: false,
	isBusy: false,
};

/** Sugestão inicial: a agenda principal da conta Google, que é onde a pessoa costuma olhar. */
function pickDefault(calendars: DeviceCalendar[]): DeviceCalendar | undefined {
	return (
		calendars.find((calendar) => calendar.isGoogle && calendar.isPrimary) ??
		calendars.find((calendar) => calendar.isGoogle)
	);
}

export const useCalendarStore = create<CalendarState>((set, get) => {
	async function run<T>(task: () => Promise<T>): Promise<T> {
		set({ isBusy: true });
		try {
			return await task();
		} finally {
			set({ isBusy: false });
		}
	}

	return {
		...initialState,
		load: async (db) => {
			const [settings, rows, permission] = await Promise.all([
				getCalendarSettings(db),
				listCalendarEventRows(db),
				getCalendarPermission(),
			]);
			const calendars =
				permission === "granted" ? await listWritableCalendars() : [];

			let { calendarId } = settings;
			// Uma agenda escolhida que deixou de existir (conta removida) volta a ser escolha.
			if (calendarId && calendars.length > 0) {
				if (!calendars.some((calendar) => calendar.id === calendarId)) {
					calendarId = null;
				}
			}
			if (!calendarId) {
				const suggestion = pickDefault(calendars);
				if (suggestion) {
					calendarId = suggestion.id;
					await setCalendarId(db, calendarId);
				}
			}
			set({
				permission,
				calendars,
				calendarId,
				recurring: settings.recurring,
				eventCount: rows.length,
				isLoaded: true,
			});
		},
		requestPermission: async (db) => {
			const permission = await requestCalendarPermission();
			if (permission === "granted") await get().load(db);
			else set({ permission });
			return permission;
		},
		selectCalendar: async (db, calendarId) => {
			await setCalendarId(db, calendarId);
			set({ calendarId });
		},
		changeRecurring: async (db, recurring) => {
			await setCalendarRecurring(db, recurring);
			set({ recurring });
		},
		sync: (db, now) =>
			run(async () => {
				const result = await syncRoutineToCalendar(db, calendarGateway, now);
				set({ eventCount: (await listCalendarEventRows(db)).length });
				return result;
			}),
		removeAll: (db) =>
			run(async () => {
				const removed = await removeRoutineEvents(db, calendarGateway);
				set({ eventCount: 0 });
				return removed;
			}),
		reset: () => set({ ...initialState }),
	};
});
