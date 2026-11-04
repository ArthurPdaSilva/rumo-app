import { addWeeks, startOfWeek } from "date-fns";

/** Semana de segunda a domingo (horário local) que contém `date`: [início, fim). */
export function weekRange(date: Date): { start: Date; end: Date } {
	const start = startOfWeek(date, { weekStartsOn: 1 });
	return { start, end: addWeeks(start, 1) };
}

/** Dia (horário local) que contém `date`: [início, fim). */
export function dayRange(date: Date): { start: Date; end: Date } {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { start, end };
}
