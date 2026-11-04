import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Database, TemporaryDatabase } from "../../database/client";

type SqlValue = string | number | null;

/** Pasta temporária única para os arquivos `.db` dos testes. */
export function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), "rumo-test-"));
}

/**
 * Banco SQLite real, com a mesma API assíncrona do expo-sqlite usada pelo
 * app. Permite testar SQL, migrations e repositories de verdade. Em memória
 * por padrão; passe um caminho para abrir um arquivo.
 */
export function createTestDatabase(
	path = ":memory:",
): Database & { close: () => void } {
	const raw = new DatabaseSync(path);

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
		serializeAsync: async () => {
			const dir = makeTempDir();
			const file = join(dir, "dump.db");
			try {
				raw.exec(`VACUUM INTO '${file}'`);
				return new Uint8Array(readFileSync(file));
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	} as unknown as Database & { close: () => void };
}

/** Faz o papel do `deserializeDatabaseAsync` do expo-sqlite nos testes. */
export async function openTestRumoFile(
	bytes: Uint8Array,
): Promise<TemporaryDatabase> {
	const dir = makeTempDir();
	const file = join(dir, "incoming.db");
	writeFileSync(file, bytes);
	const db = createTestDatabase(file);
	return Object.assign(db, {
		closeAsync: async () => {
			db.close();
			rmSync(dir, { recursive: true, force: true });
		},
	}) as unknown as TemporaryDatabase;
}
