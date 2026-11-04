/** Tempos fixos do Pomodoro na primeira versão (em minutos). */
export const POMODORO_FOCUS_MINUTES = 25;
export const POMODORO_BREAK_MINUTES = 5;
export const POMODORO_LONG_BREAK_MINUTES = 15;
export const POMODORO_CYCLES_UNTIL_LONG_BREAK = 4;

/** Antecedência padrão do lembrete de um bloco da rotina (em minutos). */
export const DEFAULT_REMINDER_MINUTES = 10;

/** Marcos de dias sem ceder que geram notificação. */
export const STREAK_MILESTONE_DAYS = [
	1, 3, 7, 14, 30, 60, 90, 180, 365,
] as const;

export const DEFAULT_DAILY_MESSAGE_TIME = "08:30";

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 24;

export const ADDICTION_ICONS = [
	"leaf",
	"smoking",
	"glass-wine",
	"cellphone",
	"gamepad-variant",
	"candy",
	"coffee",
	"cash",
] as const;
export type AddictionIcon = (typeof ADDICTION_ICONS)[number];

export const ADDICTION_NAME_MIN_LENGTH = 2;
export const ADDICTION_NAME_MAX_LENGTH = 40;

export type PomodoroOnFocusEnd = "ask" | "auto_complete";
export type ThemeMode = "light" | "dark" | "system";

export interface Profile {
	username: string;
	notificationsEnabled: boolean;
	dailyMessageTime: string;
	discreetMode: boolean;
}

export interface Addiction {
	id: number;
	name: string;
	icon: string;
	quitAt: string;
	createdAt: string;
	archivedAt: string | null;
	/** Início da contagem atual: última recaída ou, se não houver, `quitAt`. */
	streakStartedAt: string;
}

export interface Relapse {
	id: number;
	occurredAt: string;
	note: string | null;
}

export interface AddictionDetails {
	relapses: Relapse[];
	bestStreakMs: number;
}

/** Máscara de dias da semana: o bit de cada dia segue `Date#getDay()` (0 = domingo). */
export const WEEKDAY_BITS = {
	sunday: 1,
	monday: 2,
	tuesday: 4,
	wednesday: 8,
	thursday: 16,
	friday: 32,
	saturday: 64,
} as const;
export const WORKDAYS_MASK = 2 | 4 | 8 | 16 | 32;

export interface RoutineBlock {
	id: number;
	weekdays: number;
	startTime: string;
	endTime: string | null;
	title: string;
	notes: string | null;
	reminderMinutes: number;
	importId: number | null;
}

export interface Task {
	id: number;
	section: string;
	title: string;
	done: boolean;
	importId: number | null;
}

export interface WeeklyGoal {
	id: number;
	activity: string;
	targetMinutes: number;
	note: string | null;
	importId: number | null;
}
