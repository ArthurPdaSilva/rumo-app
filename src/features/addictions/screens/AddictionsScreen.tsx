import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { AddictionCard } from "@/features/addictions/components/AddictionCard";
import { useAddictionStore } from "@/features/addictions/stores/AddictionStore";
import { useThemeColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/tokens";
import { useNow } from "@/utils/useNow";

export function AddictionsScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const now = useNow();
	const addictions = useAddictionStore((state) => state.addictions);
	const isLoaded = useAddictionStore((state) => state.isLoaded);
	const load = useAddictionStore((state) => state.load);

	useEffect(() => {
		if (isLoaded) return;
		load(db).catch(() => {
			notification.error("Não foi possível carregar os seus vícios.");
		});
	}, [db, isLoaded, load]);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<FlatList
				data={addictions}
				keyExtractor={(item) => String(item.id)}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<AddictionCard
						addiction={item}
						now={now}
						onPress={() =>
							router.push({
								pathname: "/addictions/[id]",
								params: { id: String(item.id) },
							})
						}
					/>
				)}
				ListEmptyComponent={
					isLoaded ? (
						<View style={styles.empty}>
							<MaterialCommunityIcons
								name="leaf"
								size={56}
								color={colors.primary}
							/>
							<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
								Nenhum vício cadastrado
							</Text>
							<Text style={[styles.emptyText, { color: colors.textMuted }]}>
								Adicione o primeiro para acompanhar há quantos dias você está
								sem ceder. Um dia de cada vez.
							</Text>
						</View>
					) : undefined
				}
			/>
			<View style={styles.footer}>
				<ActionButton
					title="Adicionar vício"
					onPress={() => router.push("/addictions/new")}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { flexGrow: 1, gap: spacing.md, padding: spacing.md },
	empty: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.md,
		padding: spacing.lg,
	},
	emptyTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
	emptyText: { fontSize: fontSize.body, textAlign: "center", lineHeight: 24 },
	footer: { padding: spacing.md },
});
