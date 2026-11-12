import type { Database } from "@/database/client";
import {
	clearCalendarEventRows,
	deleteCalendarEventRow,
	getCalendarSettings,
	listCalendarEventRows,
	upsertCalendarEventRow,
} from "@/database/repositories/calendarRepository";
import { listBlocks } from "@/database/repositories/routineRepository";
import { planCalendarEvents } from "@/features/calendar/planner";

export interface CalendarEventDetails {
	title: string;
	notes: string | null;
	startDate: Date;
	endDate: Date;
	recurring: boolean;
}

/** O que a sincronização precisa da agenda; quem fala com o aparelho é o `calendarClient`. */
export interface CalendarGateway {
	createEvent(
		calendarId: string,
		details: CalendarEventDetails,
	): Promise<string>;
	deleteEvent(eventId: string): Promise<void>;
	eventExists(eventId: string): Promise<boolean>;
}

export interface SyncResult {
	created: number;
	updated: number;
	removed: number;
	unchanged: number;
}

export class CalendarNotSelectedError extends Error {
	constructor() {
		super("Nenhuma agenda escolhida");
		this.name = "CalendarNotSelectedError";
	}
}

const keyOf = (item: { blockId: number; weekday: number }) =>
	`${item.blockId}:${item.weekday}`;

/** O evento pode já ter sido apagado pela pessoa na agenda; isso não é erro. */
async function deleteQuietly(gateway: CalendarGateway, eventId: string) {
	try {
		await gateway.deleteEvent(eventId);
	} catch {
		// Nada a fazer: o objetivo era o evento não existir mais.
	}
}

/**
 * Deixa a agenda igual à rotina: cria o que falta, troca o que mudou e remove o
 * que saiu. Só mexe em eventos que o próprio Rumo criou (os do mapeamento).
 * Cada evento é registrado assim que é criado, então uma falha no meio não
 * deixa eventos soltos nem duplica na próxima tentativa.
 */
export async function syncRoutineToCalendar(
	db: Database,
	gateway: CalendarGateway,
	now: Date = new Date(),
): Promise<SyncResult> {
	const settings = await getCalendarSettings(db);
	if (!settings.calendarId) throw new CalendarNotSelectedError();
	const { calendarId } = settings;

	const [blocks, rows] = await Promise.all([
		listBlocks(db),
		listCalendarEventRows(db),
	]);
	const desired = planCalendarEvents(blocks, {
		today: now,
		recurring: settings.recurring,
	});
	const desiredKeys = new Set(desired.map(keyOf));
	const existing = new Map(rows.map((row) => [keyOf(row), row]));
	const result: SyncResult = {
		created: 0,
		updated: 0,
		removed: 0,
		unchanged: 0,
	};

	for (const row of rows) {
		const stillWanted = desiredKeys.has(keyOf(row));
		if (stillWanted && row.calendarId === calendarId) continue;
		await deleteQuietly(gateway, row.eventId);
		await deleteCalendarEventRow(db, row.blockId, row.weekday);
		existing.delete(keyOf(row));
		result.removed += 1;
	}

	for (const event of desired) {
		const row = existing.get(keyOf(event));
		const changed = row !== undefined && row.signature !== event.signature;
		if (row && !changed && (await gateway.eventExists(row.eventId))) {
			result.unchanged += 1;
			continue;
		}
		if (row) await deleteQuietly(gateway, row.eventId);

		const eventId = await gateway.createEvent(calendarId, event);
		await upsertCalendarEventRow(db, {
			blockId: event.blockId,
			weekday: event.weekday,
			calendarId,
			eventId,
			signature: event.signature,
		});
		if (changed) result.updated += 1;
		else result.created += 1;
	}
	return result;
}

/** Apaga da agenda todos os eventos criados pelo Rumo e devolve quantos eram. */
export async function removeRoutineEvents(
	db: Database,
	gateway: CalendarGateway,
): Promise<number> {
	const rows = await listCalendarEventRows(db);
	for (const row of rows) await deleteQuietly(gateway, row.eventId);
	await clearCalendarEventRows(db);
	return rows.length;
}
