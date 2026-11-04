import { DatabaseSync } from "node:sqlite";
import type { Database } from "../../database/client";

type SqlValue = string | number | null;

/**
 * Banco SQLite real em memória, com a mesma API assíncrona do expo-sqlite
 * usada pelo app. Permite testar SQL, migrations e repositories de verdade.
 */
export function createTestDatabase(): Database & { close: () => void } {
	const raw = new DatabaseSync(":memory:");

	return {
		close: () => raw.close(),
		execAsync: async (source: string) => {
			raw.exec(source);
		},
		getFirstAsync: async <T>(source: string, ...params: SqlValue[]) => {
			const row = raw.prepare(source).get(...params);
			return (row ?? null) as T | null;
		},
		getAllAsync: async <T>(source: string, ...params: SqlValue[]) =>
			raw.prepare(source).all(...params) as T[],
		runAsync: async (source: string, ...params: SqlValue[]) => {
			const result = raw.prepare(source).run(...params);
			return {
				lastInsertRowId: Number(result.lastInsertRowid),
				changes: Number(result.changes),
			};
		},
		withTransactionAsync: async (task: () => Promise<void>) => {
			raw.exec("BEGIN");
			try {
				await task();
				raw.exec("COMMIT");
			} catch (error) {
				raw.exec("ROLLBACK");
				throw error;
			}
		},
	} as unknown as Database & { close: () => void };
}
