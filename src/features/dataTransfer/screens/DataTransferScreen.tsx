import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { notification } from "@/components/notifications";
import { exportBackupBytes } from "@/database/repositories/transferRepository";
import { openRumoFileWithExpo } from "@/features/dataTransfer/expoRumoFile";
import { pickRumoFile } from "@/features/dataTransfer/pickRumoFile";
import {
	InvalidRumoFileError,
	NewerRumoFileError,
} from "@/features/dataTransfer/rumoFile";
import { shareBackup } from "@/features/dataTransfer/shareBackup";
import { useDataTransferStore } from "@/features/dataTransfer/stores/DataTransferStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

export function DataTransferScreen() {
	const db = useSQLiteContext();
	const colors = useThemeColors();
	const preview = useDataTransferStore((state) => state.preview);
	const prepare = useDataTransferStore((state) => state.prepare);
	const confirm = useDataTransferStore((state) => state.confirm);
	const reset = useDataTransferStore((state) => state.reset);
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState(false);

	async function choose() {
		setBusy(true);
		try {
			const file = await pickRumoFile();
			if (!file) return;
			const result = await prepare(db, openRumoFileWithExpo, file);
			if (result.lines.length === 0) {
				notification.info("Este arquivo não tem dados do Rumo para importar.");
			}
		} catch (error) {
			if (error instanceof NewerRumoFileError) {
				notification.error(
					"Este arquivo veio de uma versão mais nova do app. Atualize o Rumo.",
				);
			} else if (error instanceof InvalidRumoFileError) {
				notification.error("Este arquivo não é um .db do Rumo.");
			} else {
				notification.error("Não foi possível ler o arquivo.");
			}
		} finally {
			setBusy(false);
		}
	}

	async function apply() {
		setConfirming(false);
		setBusy(true);
		try {
			if (await confirm(db)) {
				notification.success("Importação concluída.");
			}
		} catch {
			notification.error("Não foi possível importar. Nada foi alterado.");
		} finally {
			setBusy(false);
		}
	}

	async function backup() {
		setBusy(true);
		try {
			const bytes = await exportBackupBytes(db);
			await shareBackup(bytes);
			notification.success("Backup pronto. Escolha onde salvar.");
		} catch {
			notification.error("Não foi possível criar o backup.");
		} finally {
			setBusy(false);
		}
	}

	const card = [
		styles.card,
		{ backgroundColor: colors.surface, borderColor: colors.border },
	];
	const canApply = preview !== null && preview.lines.length > 0;

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<View style={card}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					Importar arquivo .db
				</Text>
				<Text style={[styles.text, { color: colors.textMuted }]}>
					Use um backup seu ou um arquivo de plano, como o rumo-seed.db com a
					rotina, as tarefas e as metas semanais. Você vê o que muda antes de
					confirmar.
				</Text>
				{preview ? (
					<>
						<Text style={[styles.title, { color: colors.textPrimary }]}>
							{preview.fileName}
						</Text>
						{preview.lines.map((line) => (
							<Text
								key={line.category}
								style={[styles.text, { color: colors.textPrimary }]}
							>
								{line.label}: {line.incoming}
								{line.current > 0 ? ` (substitui ${line.current})` : ""}
							</Text>
						))}
						{preview.keptDone > 0 ? (
							<Text style={[styles.text, { color: colors.textMuted }]}>
								{preview.keptDone} tarefas já concluídas continuam concluídas.
							</Text>
						) : null}
						{preview.isFullBackup ? (
							<Text style={[styles.text, { color: colors.textMuted }]}>
								Backup completo: o app fica igual ao arquivo.
							</Text>
						) : null}
						{canApply ? (
							<ActionButton
								title="Importar"
								disabled={busy}
								onPress={() =>
									preview.replacesExistingData ? setConfirming(true) : apply()
								}
							/>
						) : null}
						<ActionButton
							title="Cancelar"
							variant="secondary"
							onPress={reset}
						/>
					</>
				) : (
					<ActionButton
						title="Escolher arquivo .db"
						disabled={busy}
						onPress={choose}
					/>
				)}
			</View>

			<View style={card}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					Backup
				</Text>
				<Text style={[styles.text, { color: colors.textMuted }]}>
					Gera um único arquivo .db com tudo: perfil, vícios, rotina, tarefas,
					metas e histórico. Ele não é criptografado, então guarde em um lugar
					seguro.
				</Text>
				<ActionButton
					title="Fazer backup"
					variant="secondary"
					disabled={busy}
					onPress={backup}
				/>
			</View>

			<ConfirmModal
				visible={confirming}
				title="Substituir os dados atuais?"
				message="O que estiver na lista com “substitui” será trocado pelo conteúdo do arquivo. Faça um backup antes se tiver dúvida."
				confirmLabel="Substituir"
				onConfirm={apply}
				onCancel={() => setConfirming(false)}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	card: {
		gap: spacing.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	title: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	text: { fontSize: fontSize.body, lineHeight: 24 },
});
