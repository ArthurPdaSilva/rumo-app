import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

export interface PickedRumoFile {
	name: string;
	bytes: Uint8Array;
}

/** Abre o seletor de arquivos e devolve o `.db`, ou `null` se cancelar. */
export async function pickRumoFile(): Promise<PickedRumoFile | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: "*/*",
		copyToCacheDirectory: true,
		multiple: false,
	});
	if (result.canceled) return null;
	const asset = result.assets[0];
	if (!asset) return null;
	const bytes = await new File(asset.uri).bytes();
	return { name: asset.name, bytes };
}
