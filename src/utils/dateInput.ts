import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Converte "DD/MM/AAAA" e "HH:MM" (horário local) em data, ou `null` se inválidos. */
export function parseLocalDateTime(
	dateText: string,
	timeText: string,
): Date | null {
	const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
	if (!dateMatch || !timeMatch) return null;

	const day = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const year = Number(dateMatch[3]);
	const hours = Number(timeMatch[1]);
	const minutes = Number(timeMatch[2]);
	const result = new Date(year, month - 1, day, hours, minutes, 0, 0);

	const isSameInstant =
		result.getFullYear() === year &&
		result.getMonth() === month - 1 &&
		result.getDate() === day &&
		result.getHours() === hours &&
		result.getMinutes() === minutes;
	return isSameInstant ? result : null;
}

export function formatDateInput(date: Date): string {
	return format(date, "dd/MM/yyyy");
}

export function formatTimeInput(date: Date): string {
	return format(date, "HH:mm");
}

/** Ex.: "01/10/2026 às 10:00", no horário local. */
export function formatDateTimeLabel(iso: string): string {
	return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}
