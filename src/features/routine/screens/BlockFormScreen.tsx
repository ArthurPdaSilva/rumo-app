import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { notification } from "@/components/notifications";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";
import { TextField } from "@/components/TextField";
import {
	type BlockFormValues,
	blockFormSchema,
} from "@/features/routine/schemas/blockSchema";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";
import { DEFAULT_REMINDER_MINUTES, type RoutineBlock } from "@/types";
import {
	dayBit,
	hasWeekday,
	toggleWeekday,
	WEEKDAY_LONG,
	WEEKDAY_SHORT,
} from "@/utils/weekdays";

function toFormValues(block: RoutineBlock): BlockFormValues {
	return {
		title: block.title,
		startTime: block.startTime,
		endTime: block.endTime ?? "",
		weekdays: block.weekdays,
		reminderMinutes: String(block.reminderMinutes),
		notes: block.notes ?? "",
	};
}

/** Cria um bloco (sem `id`) ou edita um existente (`/blocks/[id]`). */
export function BlockFormScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const { id, weekday } = useLocalSearchParams<{
		id?: string;
		weekday?: string;
	}>();
	const blockId = id === undefined ? null : Number(id);
	const blocks = useRoutineStore((state) => state.blocks);
	const isLoaded = useRoutineStore((state) => state.isLoaded);
	const load = useRoutineStore((state) => state.load);
	const addBlock = useRoutineStore((state) => state.addBlock);
	const editBlock = useRoutineStore((state) => state.editBlock);
	const removeBlock = useRoutineStore((state) => state.removeBlock);
	const [deleteVisible, setDeleteVisible] = useState(false);

	const block =
		blockId === null ? undefined : blocks.find((item) => item.id === blockId);
	const initialDay = Number.isInteger(Number(weekday))
		? Number(weekday)
		: new Date().getDay();

	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<BlockFormValues>({
		resolver: zodResolver(blockFormSchema),
		defaultValues: {
			title: "",
			startTime: "09:00",
			endTime: "",
			weekdays: dayBit(initialDay),
			reminderMinutes: String(DEFAULT_REMINDER_MINUTES),
			notes: "",
		},
		values: block ? toFormValues(block) : undefined,
	});

	useEffect(() => {
		if (isLoaded) return;
		load(db).catch(() => {
			notification.error("Não foi possível carregar o bloco.");
		});
	}, [db, isLoaded, load]);

	if (blockId !== null && !block) {
		return isLoaded ? (
			<ScreenPlaceholder
				icon="calendar-remove"
				title="Bloco não encontrado"
				description="Ele pode ter sido excluído."
			/>
		) : null;
	}

	async function onSubmit(values: BlockFormValues) {
		const input = {
			title: values.title,
			startTime: values.startTime,
			endTime: values.endTime === "" ? null : values.endTime,
			weekdays: values.weekdays,
			reminderMinutes: Number(values.reminderMinutes),
			notes: values.notes === "" ? null : values.notes,
		};
		try {
			if (blockId === null) {
				await addBlock(db, input);
				notification.success("Bloco criado.");
			} else {
				await editBlock(db, blockId, input);
				notification.success("Bloco salvo.");
			}
			router.back();
		} catch {
			notification.error("Não foi possível salvar o bloco. Tente novamente.");
		}
	}

	async function confirmDelete() {
		if (blockId === null) return;
		try {
			await removeBlock(db, blockId);
			setDeleteVisible(false);
			notification.success("Bloco excluído.");
			router.back();
		} catch {
			notification.error("Não foi possível excluir o bloco.");
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
				name="title"
				render={({ field }) => (
					<TextField
						label="Nome do bloco"
						placeholder="Ex.: Concurso 1, Academia"
						maxLength={80}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.title?.message}
					/>
				)}
			/>
			<Controller
				control={control}
				name="startTime"
				render={({ field }) => (
					<TextField
						label="Início"
						placeholder="HH:MM"
						keyboardType="numbers-and-punctuation"
						maxLength={5}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.startTime?.message}
					/>
				)}
			/>
			<Controller
				control={control}
				name="endTime"
				render={({ field }) => (
					<TextField
						label="Fim (opcional)"
						placeholder="HH:MM"
						keyboardType="numbers-and-punctuation"
						maxLength={5}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.endTime?.message}
					/>
				)}
			/>

			<View style={styles.group}>
				<Text style={[styles.groupLabel, { color: colors.textPrimary }]}>
					Dias da semana
				</Text>
				<Controller
					control={control}
					name="weekdays"
					render={({ field }) => (
						<View style={styles.days}>
							{WEEKDAY_SHORT.map((label, day) => {
								const checked = hasWeekday(field.value, day);
								return (
									<Pressable
										key={label}
										accessibilityRole="checkbox"
										accessibilityLabel={WEEKDAY_LONG[day]}
										accessibilityState={{ checked }}
										onPress={() =>
											field.onChange(toggleWeekday(field.value, day))
										}
										style={[
											styles.day,
											{
												backgroundColor: checked
													? colors.primary
													: colors.surface,
												borderColor: checked ? colors.primary : colors.border,
											},
										]}
									>
										<Text
											style={[
												styles.dayText,
												{
													color: checked
														? colors.background
														: colors.textPrimary,
												},
											]}
										>
											{label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					)}
				/>
				{errors.weekdays?.message ? (
					<Text
						accessibilityRole="alert"
						style={[styles.error, { color: colors.danger }]}
					>
						{errors.weekdays.message}
					</Text>
				) : null}
			</View>

			<Controller
				control={control}
				name="reminderMinutes"
				render={({ field }) => (
					<TextField
						label="Lembrete (minutos antes, 0 para não avisar)"
						keyboardType="number-pad"
						maxLength={3}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.reminderMinutes?.message}
					/>
				)}
			/>
			<Controller
				control={control}
				name="notes"
				render={({ field }) => (
					<TextField
						label="Anotações (opcional)"
						multiline
						maxLength={200}
						value={field.value}
						onChangeText={field.onChange}
						onBlur={field.onBlur}
						error={errors.notes?.message}
					/>
				)}
			/>

			<ActionButton
				title="Salvar bloco"
				disabled={isSubmitting}
				onPress={handleSubmit(onSubmit)}
			/>
			{blockId !== null ? (
				<ActionButton
					title="Excluir bloco"
					variant="secondary"
					onPress={() => setDeleteVisible(true)}
				/>
			) : null}

			<ConfirmModal
				visible={deleteVisible}
				title={`Excluir ${block?.title ?? "bloco"}?`}
				message="O bloco sai da sua rotina. Isso não pode ser desfeito."
				confirmLabel="Excluir"
				onConfirm={confirmDelete}
				onCancel={() => setDeleteVisible(false)}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	group: { gap: spacing.sm },
	groupLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
	days: { flexDirection: "row", gap: spacing.xs },
	day: {
		flex: 1,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	dayText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
	error: { fontSize: fontSize.caption },
});
