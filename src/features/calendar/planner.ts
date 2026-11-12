import { CALENDAR_DEFAULT_EVENT_MINUTES, type RoutineBlock } from "@/types";
import { minutesOfDay } from "@/utils/time";
import { weekRange } from "@/utils/week";
import { hasWeekday } from "@/utils/weekdays";

/** Evento da agenda que nasce de um bloco da rotina num dia da semana. */
export interface PlannedEvent {
	blockId: number;
	/** 0 = domingo, igual a `Date#getDay()`. */
	weekday: number;
	title: string;
	notes: string | null;
	startDate: Date;
	endDate: Date;
	recurring: boolean;
	/** Muda quando algo que vai para a agenda muda; não depende da data de hoje. */
	signature: string;
}

export interface PlanOptions {
	/** Primeira ocorrência de cada bloco é a data mais próxima a partir de hoje. */
	today: Date;
	recurring: boolean;
}

function atMinutes(day: Date, minutes: number): Date {
	return new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		Math.floor(minutes / 60),
		minutes % 60,
	);
}

function isoDay(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function signatureOf(
	block: RoutineBlock,
	recurring: boolean,
	firstDay: Date,
): string {
	// Sem repetição o evento é de uma data específica, então a data faz parte dele.
	return JSON.stringify([
		block.title,
		block.notes ?? "",
		block.startTime,
		block.endTime ?? "",
		recurring ? "weekly" : isoDay(firstDay),
	]);
}

/**
 * Um evento por bloco e por dia da semana. No Android a repetição semanal não
 * aceita "vários dias" (só repete no dia do início), então um bloco de
 * seg/qua/sex vira três eventos, cada um recorrente no seu dia.
 *
 * Repetindo, cada evento começa na próxima data daquele dia a partir de hoje.
 * Sem repetir, só entram os dias que ainda restam na semana (segunda a domingo).
 */
export function planCalendarEvents(
	blocks: RoutineBlock[],
	options: PlanOptions,
): PlannedEvent[] {
	const { today, recurring } = options;
	const weekEnd = weekRange(today).end;
	const planned: PlannedEvent[] = [];

	for (const block of blocks) {
		const startMinutes = minutesOfDay(block.startTime);
		if (startMinutes === null) continue;
		const endMinutes = block.endTime ? minutesOfDay(block.endTime) : null;

		for (let weekday = 0; weekday < 7; weekday++) {
			if (!hasWeekday(block.weekdays, weekday)) continue;
			const daysAhead = (weekday - today.getDay() + 7) % 7;
			const day = new Date(
				today.getFullYear(),
				today.getMonth(),
				today.getDate() + daysAhead,
			);
			if (!recurring && day.getTime() >= weekEnd.getTime()) continue;

			let endDate: Date;
			if (endMinutes === null || endMinutes === startMinutes) {
				endDate = atMinutes(day, startMinutes + CALENDAR_DEFAULT_EVENT_MINUTES);
			} else if (endMinutes > startMinutes) {
				endDate = atMinutes(day, endMinutes);
			} else {
				// Termina depois da meia-noite.
				endDate = atMinutes(day, endMinutes + 1440);
			}

			planned.push({
				blockId: block.id,
				weekday,
				title: block.title,
				notes: block.notes,
				startDate: atMinutes(day, startMinutes),
				endDate,
				recurring,
				signature: signatureOf(block, recurring, day),
			});
		}
	}
	return planned;
}
