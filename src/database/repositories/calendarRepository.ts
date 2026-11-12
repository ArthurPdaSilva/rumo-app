import type { Database } from "@/database/client";

export interface CalendarSettings {
	/** Agenda do aparelho que recebe os eventos; `null` até a pessoa escolher. */
	calendarId: string | null;
	/** `true`: o evento se repete toda semana; `false`: só a semana atual. */
	recurring: boolean;
}

/** Um evento criado pelo Rumo: o bloco e o dia da semana que ele representa. */
export interface CalendarEventRow {
	blockId: number;
	/** 0 = domingo, igual a `Date#getDay()`. */
	weekday: number;
	calendarId: string;
	eventId: string;
	/** Resumo do que foi enviado, para saber se o bloco mudou desde então. */
	signature: string;
}

export async function getCalendarSettings(
	db: Database,
): Promise<CalendarSettings> {
	const row = await db.getFirstAsync<{
		calendar_id: string | null;
		calendar_recurring: number;
	}>("SELECT calendar_id, calendar_recurring FROM app_state WHERE id = 1");
	return {
		calendarId: row?.calendar_id ?? null,
		recurring: (row?.calendar_recurring ?? 1) === 1,
	};
}

export async function setCalendarId(
	db: Database,
	calendarId: string | null,
): Promise<void> {
	await db.runAsync(
		"UPDATE app_state SET calendar_id = ? WHERE id = 1",
		calendarId,
	);
}

export async function setCalendarRecurring(
	db: Database,
	recurring: boolean,
): Promise<void> {
	await db.runAsync(
		"UPDATE app_state SET calendar_recurring = ? WHERE id = 1",
		recurring ? 1 : 0,
	);
}

interface EventSqlRow {
	block_id: number;
	weekday: number;
	calendar_id: string;
	event_id: string;
	signature: string;
}

export async function listCalendarEventRows(
	db: Database,
): Promise<CalendarEventRow[]> {
	const rows = await db.getAllAsync<EventSqlRow>(
		`SELECT block_id, weekday, calendar_id, event_id, signature
		FROM calendar_events ORDER BY block_id, weekday`,
	);
	return rows.map((row) => ({
		blockId: row.block_id,
		weekday: row.weekday,
		calendarId: row.calendar_id,
		eventId: row.event_id,
		signature: row.signature,
	}));
}

export async function upsertCalendarEventRow(
	db: Database,
	row: CalendarEventRow,
): Promise<void> {
	await db.runAsync(
		`INSERT OR REPLACE INTO calendar_events
			(block_id, weekday, calendar_id, event_id, signature)
		VALUES (?, ?, ?, ?, ?)`,
		row.blockId,
		row.weekday,
		row.calendarId,
		row.eventId,
		row.signature,
	);
}

export async function deleteCalendarEventRow(
	db: Database,
	blockId: number,
	weekday: number,
): Promise<void> {
	await db.runAsync(
		"DELETE FROM calendar_events WHERE block_id = ? AND weekday = ?",
		blockId,
		weekday,
	);
}

export async function clearCalendarEventRows(db: Database): Promise<void> {
	await db.runAsync("DELETE FROM calendar_events");
}
