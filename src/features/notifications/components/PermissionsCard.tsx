import { Linking, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { useNotificationPermissions } from "@/features/notifications/hooks/useNotificationPermissions";
import { useThemeColors } from "@/styles/theme";
import { fontSize, spacing } from "@/styles/tokens";

/**
 * Mostra o que falta para os avisos funcionarem: a permissão de notificações
 * e, no Android 12+, a de alarme exato (sem ela os avisos chegam aproximados).
 */
export function PermissionsCard() {
	const colors = useThemeColors();
	const { notifications, exactAlarm, askExactAlarm } =
		useNotificationPermissions();

	async function onAllowExact() {
		try {
			const state = await askExactAlarm();
			if (state === "granted") {
				notification.success("Horário exato liberado.");
			}
		} catch {
			notification.error("Não foi possível abrir os ajustes do sistema.");
		}
	}

	const notificationsBlocked = notifications === "denied";
	const exactMissing = exactAlarm === "denied";
	if (!notificationsBlocked && !exactMissing) return null;

	return (
		<View style={styles.container}>
			{notificationsBlocked ? (
				<View style={styles.block}>
					<Text style={[styles.text, { color: colors.textMuted }]}>
						O sistema está bloqueando as notificações do Rumo. Libere nos
						ajustes do aparelho para receber marcos, lembretes e avisos do foco.
					</Text>
					<ActionButton
						title="Abrir ajustes do aparelho"
						variant="secondary"
						onPress={() => Linking.openSettings()}
					/>
				</View>
			) : null}
			{exactMissing ? (
				<View style={styles.block}>
					<Text style={[styles.text, { color: colors.textMuted }]}>
						Sem a permissão de alarme exato, os lembretes e os avisos do foco
						podem atrasar alguns minutos. Os avisos continuam funcionando.
					</Text>
					<ActionButton
						title="Permitir horário exato"
						variant="secondary"
						onPress={onAllowExact}
					/>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { gap: spacing.md },
	block: { gap: spacing.sm },
	text: { fontSize: fontSize.caption, lineHeight: 18 },
});
