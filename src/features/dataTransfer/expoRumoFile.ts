import { deserializeDatabaseAsync } from "expo-sqlite";
import type { TemporaryDatabase } from "@/database/client";

/** Abre um `.db` recebido como banco em memória, sem tocar no `rumo.db` do app. */
export async function openRumoFileWithExpo(
	bytes: Uint8Array,
): Promise<TemporaryDatabase> {
	return deserializeDatabaseAsync(
		bytes,
	) as unknown as Promise<TemporaryDatabase>;
}
