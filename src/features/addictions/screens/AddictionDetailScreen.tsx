import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { notification } from "@/components/notifications";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";
import { TextField } from "@/components/TextField";
import { toAddictionIcon } from "@/features/addictions/icons";
import { useAddictionStore } from "@/features/addictions/stores/AddictionStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { formatDateTimeLabel } from "@/utils/dateInput";
import {
	formatStreak,
	getNextMilestone,
	getStreak,
	streakFromMs,
} from "@/utils/streak";
import { useNow } from "@/utils/useNow";

export function AddictionDetailScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const now = useNow();
	const { id } = useLocalSearchParams<{ id: string }>();
	const addictionId = Number(id);
	const addictions = useAddictionStore((state) => state.addictions);
	const isLoaded = useAddictionStore((state) => state.isLoaded);
	const details = useAddictionStore((state) => state.details[addictionId]);
	const load = useAddictionStore((state) => state.load);
	const loadDetails = useAddictionStore((state) => state.loadDetails);
	const registerRelapse = useAddictionStore((state) => state.registerRelapse);
	const remove = useAddictionStore((state) => state.remove);
	const [relapseVisible, setRelapseVisible] = useState(false);
	const [deleteVisible, setDeleteVisible] = useState(false);
	const [note, setNote] = useState("");

	const addiction = addictions.find((item) => item.id === addictionId);

	useEffect(() => {
		const hydrate = async () => {
			if (!isLoaded) await load(db);
			await loadDetails(db, addictionId);
		};
		hydrate().catch(() => {
			notification.error("Não foi possível carregar este vício.");
		});
	}, [db, addictionId, isLoaded, load, loadDetails]);

	if (!addiction) {
		return isLoaded ? (
			<ScreenPlaceholder
				icon="leaf-off"
				title="Vício não encontrado"
				description="Ele pode ter sido excluído."
			/>
		) : null;
	}

	const streak = getStreak(addiction.streakStartedAt, now);
	const nextMilestone = getNextMilestone(streak.days);
	const bestStreak = details ? streakFromMs(details.bestStreakMs) : null;

	async function confirmRelapse() {
		try {
			await registerRelapse(db, addictionId, note.trim() || null);
			setRelapseVisible(false);
			setNote("");
			notification.success("Contagem reiniciada. Um dia de cada vez.");
		} catch {
			notification.error("Não foi possível registrar. Tente novamente.");
		}
	}

	async function confirmDelete() {
		try {
			await remove(db, addictionId);
			setDeleteVisible(false);
			notification.success("Vício excluído.");
			router.back();
		} catch {
			notification.error("Não foi possível excluir o vício.");
		}
	}

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<View
				style={[
					styles.hero,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<MaterialCommunityIcons
					name={toAddictionIcon(addiction.icon)}
					size={40}
					color={colors.primary}
				/>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					{addiction.name}
				</Text>
				<Text
					accessibilityLabel="Dias sem ceder"
					style={[styles.days, { color: colors.primary }]}
				>
					{streak.days}
				</Text>
				<Text style={[styles.daysLabel, { color: colors.textMuted }]}>
					{streak.days === 1 ? "dia sem ceder" : "dias sem ceder"}
					{streak.hours > 0 ? ` e ${streak.hours} h` : ""}
				</Text>
				<Text style={[styles.caption, { color: colors.textMuted }]}>
					Contagem desde {formatDateTimeLabel(addiction.streakStartedAt)}
				</Text>
			</View>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.cardRow, { color: colors.textPrimary }]}>
					{nextMilestone
						? `Próximo marco: ${nextMilestone} dias (faltam ${nextMilestone - streak.days})`
						: "Você alcançou todos os marcos. Continue assim."}
				</Text>
				{bestStreak ? (
					<Text style={[styles.cardRow, { color: colors.textPrimary }]}>
						Melhor período: {formatStreak(bestStreak)}
					</Text>
				) : null}
			</View>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
					Recaídas
				</Text>
				{details && details.relapses.length > 0 ? (
					details.relapses.map((relapse) => (
						<View key={relapse.id} style={styles.relapse}>
							<Text style={[styles.cardRow, { color: colors.textPrimary }]}>
								{formatDateTimeLabel(relapse.occurredAt)}
							</Text>
							{relapse.note ? (
								<Text style={[styles.caption, { color: colors.textMuted }]}>
									{relapse.note}
								</Text>
							) : null}
						</View>
					))
				) : (
					<Text style={[styles.caption, { color: colors.textMuted }]}>
						Nenhuma recaída registrada.
					</Text>
				)}
			</View>

			<ActionButton
				title="Registrei uma recaída"
				onPress={() => setRelapseVisible(true)}
			/>
			<ActionButton
				title="Excluir vício"
				variant="secondary"
				onPress={() => setDeleteVisible(true)}
			/>

			<ConfirmModal
				visible={relapseVisible}
				title="Recomeçar faz parte"
				message="Sua contagem volta a zero, mas o histórico e o seu melhor período ficam guardados."
				confirmLabel="Reiniciar contagem"
				onConfirm={confirmRelapse}
				onCancel={() => setRelapseVisible(false)}
			>
				<TextField
					label="Quer anotar o que aconteceu? (opcional)"
					multiline
					maxLength={200}
					value={note}
					onChangeText={setNote}
				/>
			</ConfirmModal>

			<ConfirmModal
				visible={deleteVisible}
				title={`Excluir ${addiction.name}?`}
				message="A contagem e todo o histórico de recaídas serão apagados. Isso não pode ser desfeito."
				confirmLabel="Excluir"
				onConfirm={confirmDelete}
				onCancel={() => setDeleteVisible(false)}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	hero: {
		alignItems: "center",
		gap: spacing.xs,
		padding: spacing.lg,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	name: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
	days: { fontSize: 72, fontWeight: fontWeight.bold, lineHeight: 80 },
	daysLabel: { fontSize: fontSize.body },
	card: {
		gap: spacing.sm,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	cardRow: { fontSize: fontSize.body },
	caption: { fontSize: fontSize.caption, lineHeight: 18 },
	relapse: { gap: spacing.xs },
});
