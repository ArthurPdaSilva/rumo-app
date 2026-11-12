import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { notification } from "@/components/notifications";
import { SwitchRow } from "@/components/SwitchRow";
import type { DeviceCalendar } from "@/features/calendar/calendarClient";
import {
	CalendarNotSelectedError,
	type SyncResult,
} from "@/features/calendar/calendarSync";
import { useCalendarStore } from "@/features/calendar/stores/CalendarStore";
import { Chip } from "@/features/focus/components/Chip";
import { useRoutineStore } from "@/features/routine/stores/RoutineStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** "3 novos, 1 atualizado e 2 removidos"; só o que aconteceu. */
export function describeSync(result: SyncResult): string {
	const parts: string[] = [];
	if (result.created > 0) parts.push(plural(result.created, "novo", "novos"));
	if (result.updated > 0) {
		parts.push(plural(result.updated, "atualizado", "atualizados"));
	}
	if (result.removed > 0) {
		parts.push(plural(result.removed, "removido", "removidos"));
	}
	if (parts.length === 0) return "A agenda já estava em dia.";
	const last = parts.pop();
	const list = parts.length > 0 ? `${parts.join(", ")} e ${last}` : last;
	return `Agenda atualizada: ${list}.`;
}

function calendarLabel(calendar: DeviceCalendar): string {
	return calendar.account && calendar.account !== calendar.title
		? `${calendar.title} · ${calendar.account}`
		: calendar.title;
}

export function CalendarSyncScreen() {
	const db = useSQLiteContext();
	const colors = useThemeColors();
	const permission = useCalendarStore((state) => state.permission);
	const calendars = useCalendarStore((state) => state.calendars);
	const calendarId = useCalendarStore((state) => state.calendarId);
	const recurring = useCalendarStore((state) => state.recurring);
	const eventCount = useCalendarStore((state) => state.eventCount);
	const isLoaded = useCalendarStore((state) => state.isLoaded);
	const isBusy = useCalendarStore((state) => state.isBusy);
	const actions = useCalendarStore.getState;
	const routineLoaded = useRoutineStore((state) => state.isLoaded);
	const blockCount = useRoutineStore((state) => state.blocks.length);
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	useEffect(() => {
		actions()
			.load(db)
			.catch((error: unknown) => {
				// Só a mensagem técnica do módulo nativo, nunca dados da rotina.
				if (__DEV__) {
					console.warn(
						"[calendar] falha ao ler as agendas:",
						error instanceof Error ? error.message : error,
					);
				}
				notification.error("Não foi possível ler as suas agendas.");
			});
		if (!useRoutineStore.getState().isLoaded) {
			useRoutineStore
				.getState()
				.load(db)
				.catch(() => notification.error("Não foi possível carregar a rotina."));
		}
	}, [db, actions]);

	async function onAllow() {
		try {
			if (permission === "denied") {
				await Linking.openSettings();
				return;
			}
			const result = await actions().requestPermission(db);
			if (result === "granted") {
				notification.success("Acesso à agenda liberado.");
			} else {
				notification.info("Sem acesso à agenda não dá para criar os eventos.");
			}
		} catch {
			notification.error("Não foi possível pedir acesso à agenda.");
		}
	}

	async function onSelect(id: string) {
		try {
			await actions().selectCalendar(db, id);
			notification.success("Agenda escolhida.");
		} catch {
			notification.error("Não foi possível salvar a agenda escolhida.");
		}
	}

	async function onToggleRecurring(value: boolean) {
		try {
			await actions().changeRecurring(db, value);
			notification.success(
				value ? "Os eventos vão se repetir toda semana." : "Só a semana atual.",
			);
		} catch {
			notification.error("Não foi possível salvar a preferência.");
		}
	}

	async function onSync() {
		try {
			const result = await actions().sync(db);
			notification.success(describeSync(result));
		} catch (error) {
			if (error instanceof CalendarNotSelectedError) {
				notification.info("Escolha primeiro uma agenda.");
				return;
			}
			notification.error("Não foi possível enviar a rotina para a agenda.");
		}
	}

	async function onRemove() {
		setConfirmingRemove(false);
		try {
			const removed = await actions().removeAll(db);
			notification.success(
				removed === 0
					? "Não havia eventos do Rumo na agenda."
					: `${plural(removed, "evento removido", "eventos removidos")} da agenda.`,
			);
		} catch {
			notification.error("Não foi possível remover os eventos.");
		}
	}

	const card = [
		styles.card,
		{ backgroundColor: colors.surface, borderColor: colors.border },
	];
	const hint = [styles.hint, { color: colors.textMuted }];
	const heading = [styles.heading, { color: colors.textPrimary }];

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<View style={card}>
				<Text style={heading}>Rotina na sua agenda</Text>
				<Text style={hint}>
					Cada bloco da rotina vira um evento na agenda do aparelho, com nome,
					dia e horário. Se a sua conta Google está sincronizando, o Android o
					leva ao Google Agenda sozinho. O Rumo não envia nada pela internet e
					não guarda a sua conta.
				</Text>
			</View>

			{isLoaded && permission !== "granted" ? (
				<View style={card}>
					<Text style={heading}>Acesso à agenda</Text>
					<Text style={hint}>
						{permission === "denied"
							? "O acesso à agenda está bloqueado nos ajustes do aparelho. Libere para criar os eventos."
							: "O Rumo precisa de permissão para criar eventos na sua agenda."}
					</Text>
					<ActionButton
						title={
							permission === "denied"
								? "Abrir ajustes do aparelho"
								: "Permitir acesso à agenda"
						}
						onPress={onAllow}
					/>
				</View>
			) : null}

			{isLoaded && permission === "granted" ? (
				<>
					<View style={card}>
						<Text style={heading}>Em qual agenda?</Text>
						{calendars.length === 0 ? (
							<Text style={hint}>
								Nenhuma agenda editável encontrada. Entre na sua conta Google
								nos ajustes do aparelho e tente de novo.
							</Text>
						) : (
							<View style={styles.chips} accessibilityRole="radiogroup">
								{calendars.map((calendar) => (
									<Chip
										key={calendar.id}
										label={calendarLabel(calendar)}
										selected={calendar.id === calendarId}
										onPress={() => onSelect(calendar.id)}
									/>
								))}
							</View>
						)}
					</View>

					<SwitchRow
						label="Repetir toda semana"
						description="Ligado, cada bloco se repete toda semana na agenda. Desligado, só os dias que restam da semana atual são enviados."
						value={recurring}
						onValueChange={onToggleRecurring}
					/>

					<ActionButton
						title={isBusy ? "Sincronizando..." : "Sincronizar rotina"}
						disabled={isBusy || !calendarId || calendars.length === 0}
						onPress={onSync}
					/>
					{routineLoaded && blockCount === 0 ? (
						<Text style={hint}>
							A sua rotina ainda não tem blocos. Crie um na aba Rotina ou
							importe um arquivo .db pelo Perfil.
						</Text>
					) : null}

					<View style={card}>
						<Text style={heading}>Eventos do Rumo na agenda</Text>
						<Text style={hint}>
							{eventCount === 0
								? "Nenhum evento criado ainda."
								: `${plural(eventCount, "evento criado", "eventos criados")} pelo Rumo. Os eventos que você criou por conta própria nunca são tocados.`}
						</Text>
						{eventCount > 0 ? (
							<ActionButton
								title="Remover eventos do Rumo"
								variant="secondary"
								disabled={isBusy}
								onPress={() => setConfirmingRemove(true)}
							/>
						) : null}
					</View>
				</>
			) : null}

			<ConfirmModal
				visible={confirmingRemove}
				title="Remover os eventos?"
				message="Os eventos criados pelo Rumo serão apagados da agenda. A sua rotina no app não muda."
				confirmLabel="Remover"
				cancelLabel="Manter"
				onCancel={() => setConfirmingRemove(false)}
				onConfirm={onRemove}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	card: {
		gap: spacing.md,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	heading: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	hint: { fontSize: fontSize.caption, lineHeight: 20 },
	chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
