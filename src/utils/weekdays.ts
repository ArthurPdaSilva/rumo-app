import { WEEKDAY_BITS, WORKDAYS_MASK } from "@/types";

/** Índice 0 = domingo, igual a `Date#getDay()`. */
export const WEEKDAY_SHORT = [
	"Dom",
	"Seg",
	"Ter",
	"Qua",
	"Qui",
	"Sex",
	"Sáb",
] as const;

export const WEEKDAY_LONG = [
	"Domingo",
	"Segunda",
	"Terça",
	"Quarta",
	"Quinta",
	"Sexta",
	"Sábado",
] as const;

const ALL_DAYS_MASK = Object.values(WEEKDAY_BITS).reduce((a, b) => a | b, 0);

export function dayBit(day: number): number {
	return 1 << day;
}

export function hasWeekday(mask: number, day: number): boolean {
	return (mask & dayBit(day)) !== 0;
}

export function toggleWeekday(mask: number, day: number): number {
	return mask ^ dayBit(day);
}

/** Texto curto para a máscara: "Dias úteis", "Sábado", "Seg, Qua e Sex". */
export function describeWeekdays(mask: number): string {
	if (mask === ALL_DAYS_MASK) return "Todos os dias";
	if (mask === WORKDAYS_MASK) return "Dias úteis";
	if (mask === (WEEKDAY_BITS.saturday | WEEKDAY_BITS.sunday))
		return "Fim de semana";
	const days = [0, 1, 2, 3, 4, 5, 6].filter((day) => hasWeekday(mask, day));
	if (days.length === 0) return "Nenhum dia";
	if (days.length === 1) return WEEKDAY_LONG[days[0]];
	const names = days.map((day) => WEEKDAY_SHORT[day]);
	return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
