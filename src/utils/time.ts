const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
	return TIME_PATTERN.test(value);
}

/** "09:40" → 580. Devolve `null` se o texto não for HH:MM válido. */
export function minutesOfDay(value: string): number | null {
	const match = TIME_PATTERN.exec(value);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesOfDate(date: Date): number {
	return date.getHours() * 60 + date.getMinutes();
}

/** "3h30", "4h", "45 min". */
export function formatMinutes(total: number): string {
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	if (hours === 0) return `${minutes} min`;
	return minutes === 0
		? `${hours}h`
		: `${hours}h${String(minutes).padStart(2, "0")}`;
}
