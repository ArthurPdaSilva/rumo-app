import { INITIAL_MIGRATION_SQL } from "./001_initial";

export interface Migration {
	version: number;
	sql: string;
}

export const MIGRATIONS: Migration[] = [
	{ version: 1, sql: INITIAL_MIGRATION_SQL },
];
