import type { ReactNode } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

interface ConfirmModalProps {
	visible: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
	children?: ReactNode;
}

export function ConfirmModal({
	visible,
	title,
	message,
	confirmLabel,
	cancelLabel = "Cancelar",
	onConfirm,
	onCancel,
	children,
}: ConfirmModalProps) {
	const colors = useThemeColors();

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			<View style={styles.overlay}>
				<View
					accessibilityViewIsModal
					style={[
						styles.card,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
				>
					<Text style={[styles.title, { color: colors.textPrimary }]}>
						{title}
					</Text>
					<Text style={[styles.message, { color: colors.textMuted }]}>
						{message}
					</Text>
					{children}
					<View style={styles.actions}>
						<ActionButton title={confirmLabel} onPress={onConfirm} />
						<ActionButton
							title={cancelLabel}
							variant="secondary"
							onPress={onCancel}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	card: {
		gap: spacing.md,
		padding: spacing.lg,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	title: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
	message: { fontSize: fontSize.body, lineHeight: 24 },
	actions: { gap: spacing.sm },
});
