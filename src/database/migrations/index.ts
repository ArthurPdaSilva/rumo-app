import { INITIAL_MIGRATION_SQL } from "./001_initial";
import { POMODORO_ACTIVE_MIGRATION_SQL } from "./002_pomodoro_active";
import { CALENDAR_SYNC_MIGRATION_SQL } from "./003_calendar_sync";

export interface Migration {
	version: number;
	sql: string;
}

export const MIGRATIONS: Migration[] = [
	{ version: 1, sql: INITIAL_MIGRATION_SQL },
	{ version: 2, sql: POMODORO_ACTIVE_MIGRATION_SQL },
	{ version: 3, sql: CALENDAR_SYNC_MIGRATION_SQL },
];
