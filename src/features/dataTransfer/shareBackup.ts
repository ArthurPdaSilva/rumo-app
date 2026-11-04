import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";

export function backupFileName(now: Date): string {
	return `rumo-backup-${format(now, "yyyy-MM-dd-HHmm")}.db`;
}

/** Grava o backup no cache e abre a folha de compartilhamento do Android. */
export async function shareBackup(
	bytes: Uint8Array,
	now: Date = new Date(),
): Promise<string> {
	const name = backupFileName(now);
	const file = new File(Paths.cache, name);
	file.create({ overwrite: true });
	file.write(bytes);
	await Sharing.shareAsync(file.uri, {
		mimeType: "application/octet-stream",
		dialogTitle: "Salvar backup do Rumo",
	});
	return name;
}
