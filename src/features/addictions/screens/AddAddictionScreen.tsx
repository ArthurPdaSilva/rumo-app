import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { TextField } from "@/components/TextField";
import {
	type AddictionFormValues,
	addictionFormSchema,
} from "@/features/addictions/schemas/addictionSchema";
import { useAddictionStore } from "@/features/addictions/stores/AddictionStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { ADDICTION_ICONS } from "@/types";
import {
	formatDateInput,
	formatTimeInput,
	parseLocalDateTime,
} from "@/utils/dateInput";

export function AddAddictionScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const add = useAddictionStore((state) => state.add);
	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<AddictionFormValues>({
		resolver: zodResolver(addictionFormSchema),
		defaultValues: {
			name: "",
			icon: "leaf",
			quitDate: formatDateInput(new Date()),
			quitTime: formatTimeInput(new Date()),
		},
	});

	async function onSubmit(values: AddictionFormValues) {
		const quitAt = parseLocalDateTime(values.quitDate, values.quitTime);
		if (!quitAt) return;

		try {
			await add(db, {
				name: values.name,
				icon: values.icon,
				quitAt: quitAt.toISOString(),
			});
			notification.success("Vício adicionado. Um dia de cada vez.");
			router.back();
		} catch {
			notification.error("Não foi possível salvar o vício. Tente novamente.");
		}
	}

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Controller
				control={control}
				name="name"
				render={({ field }) => (
					<TextField
						label="Nome"
						placeholder="Ex.: cigarro, refrigerante, redes sociais"
						maxLength={40}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.name?.message}
					/>
				)}
			/>

			<View style={styles.group}>
				<Text style={[styles.groupLabel, { color: colors.textPrimary }]}>
					Ícone
				</Text>
				<Controller
					control={control}
					name="icon"
					render={({ field }) => (
						<View style={styles.icons}>
							{ADDICTION_ICONS.map((icon) => {
								const selected = field.value === icon;
								return (
									<Pressable
										key={icon}
										accessibilityRole="radio"
										accessibilityLabel={`Ícone ${icon}`}
										accessibilityState={{ selected }}
										onPress={() => field.onChange(icon)}
										style={[
											styles.iconOption,
											{
												backgroundColor: selected
													? colors.primary
													: colors.surface,
												borderColor: selected ? colors.primary : colors.border,
											},
										]}
									>
										<MaterialCommunityIcons
											name={icon}
											size={26}
											color={selected ? colors.background : colors.textMuted}
										/>
									</Pressable>
								);
							})}
						</View>
					)}
				/>
			</View>

			<Text style={[styles.hint, { color: colors.textMuted }]}>
				Quando você parou? Se foi agora, deixe como está.
			</Text>
			<Controller
				control={control}
				name="quitDate"
				render={({ field }) => (
					<TextField
						label="Data em que parou"
						placeholder="DD/MM/AAAA"
						keyboardType="numbers-and-punctuation"
						maxLength={10}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.quitDate?.message}
					/>
				)}
			/>
			<Controller
				control={control}
				name="quitTime"
				render={({ field }) => (
					<TextField
						label="Hora em que parou"
						placeholder="HH:MM"
						keyboardType="numbers-and-punctuation"
						maxLength={5}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.quitTime?.message}
					/>
				)}
			/>

			<ActionButton
				title="Salvar vício"
				disabled={isSubmitting}
				onPress={handleSubmit(onSubmit)}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	group: { gap: spacing.sm },
	groupLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
	icons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	iconOption: {
		width: 52,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	hint: { fontSize: fontSize.caption, lineHeight: 18 },
});
