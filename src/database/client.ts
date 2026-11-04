import type { SQLiteDatabase } from "expo-sqlite";
import { MIGRATIONS, type Migration } from "@/database/migrations";

export const DATABASE_NAME = "rumo.db";

/** Subconjunto da API do expo-sqlite usado pelo app, facilitando os testes. */
export type Database = Pick<
	SQLiteDatabase,
	| "execAsync"
	| "getFirstAsync"
	| "getAllAsync"
	| "runAsync"
	| "withTransactionAsync"
	| "serializeAsync"
>;

/** Banco aberto a partir de um arquivo recebido; precisa ser fechado depois de lido. */
export type TemporaryDatabase = Database & { closeAsync: () => Promise<void> };

export async function migrateDatabase(
	db: Database,
	migrations: Migration[] = MIGRATIONS,
): Promise<number> {
	await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
	const row = await db.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);
	let current = row?.user_version ?? 0;

	for (const migration of [...migrations].sort(
		(a, b) => a.version - b.version,
	)) {
		if (migration.version <= current) continue;
		await db.withTransactionAsync(async () => {
			await db.execAsync(migration.sql);
			await db.execAsync(`PRAGMA user_version = ${migration.version}`);
		});
		current = migration.version;
	}

	return current;
}

/** Callback de inicialização do `SQLiteProvider`. */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
	await migrateDatabase(db);
}
