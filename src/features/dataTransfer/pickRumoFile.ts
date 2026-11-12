import { File } from "expo-file-system";

export interface PickedRumoFile {
	name: string;
	bytes: Uint8Array;
}

/**
 * Abre o seletor de arquivos e devolve o `.db`, ou `null` se cancelar.
 *
 * Usa o seletor do próprio expo-file-system: o arquivo escolhido já vem com
 * permissão de leitura, o que o `expo-document-picker` + `new File(uri)` não
 * garantia (dava "Missing 'READ' permission" no Android).
 */
export async function pickRumoFile(): Promise<PickedRumoFile | null> {
	const picked = await File.pickFileAsync();
	if (picked.canceled) return null;
	const file = picked.result;
	return { name: file.name, bytes: await file.bytes() };
}
