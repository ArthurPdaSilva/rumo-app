import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { PermissionsCard } from "@/features/notifications/components/PermissionsCard";
import { SwitchRow } from "@/components/SwitchRow";
import { TextField } from "@/components/TextField";
import {
	type ProfileFormValues,
	profileFormSchema,
} from "@/features/profile/schemas/profileSchema";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

export function ProfileScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const profile = useProfileStore((state) => state.profile);
	const saveDetails = useProfileStore((state) => state.saveDetails);
	const setNotificationsEnabled = useProfileStore(
		(state) => state.setNotificationsEnabled,
	);
	const setDiscreetMode = useProfileStore((state) => state.setDiscreetMode);
	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			username: profile?.username ?? "",
			dailyMessageTime: profile?.dailyMessageTime ?? "",
		},
	});

	if (!profile) return null;

	async function onSubmit(values: ProfileFormValues) {
		try {
			await saveDetails(db, values);
			notification.success("Perfil atualizado.");
		} catch {
			notification.error("Não foi possível salvar o perfil. Tente novamente.");
		}
	}

	async function onToggleNotifications(enabled: boolean) {
		try {
			await setNotificationsEnabled(db, enabled);
			notification.success(
				enabled ? "Notificações ativadas." : "Notificações desativadas.",
			);
		} catch {
			notification.error("Não foi possível alterar as notificações.");
		}
	}

	async function onToggleDiscreet(enabled: boolean) {
		try {
			await setDiscreetMode(db, enabled);
			notification.success(
				enabled ? "Modo discreto ativado." : "Modo discreto desativado.",
			);
		} catch {
			notification.error("Não foi possível alterar o modo discreto.");
		}
	}

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={[styles.greeting, { color: colors.textPrimary }]}>
				Olá, {profile.username}
			</Text>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
					Seus dados
				</Text>
				<Controller
					control={control}
					name="username"
					render={({ field }) => (
						<TextField
							label="Nome de usuário"
							autoCapitalize="words"
							autoCorrect={false}
							maxLength={40}
							value={field.value}
							onChangeText={field.onChange}
							onBlur={field.onBlur}
							error={errors.username?.message}
						/>
					)}
				/>
				<Controller
					control={control}
					name="dailyMessageTime"
					render={({ field }) => (
						<TextField
							label="Horário da mensagem diária"
							placeholder="08:30"
							keyboardType="numbers-and-punctuation"
							maxLength={5}
							value={field.value}
							onChangeText={field.onChange}
							onBlur={field.onBlur}
							error={errors.dailyMessageTime?.message}
						/>
					)}
				/>
				<ActionButton
					title="Salvar"
					disabled={isSubmitting}
					onPress={handleSubmit(onSubmit)}
				/>
			</View>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
					Notificações
				</Text>
				<SwitchRow
					label="Notificações"
					description="Marcos, lembretes da rotina e mensagem diária."
					value={profile.notificationsEnabled}
					onValueChange={onToggleNotifications}
				/>
				<SwitchRow
					label="Modo discreto"
					description="Esconde o nome do vício na tela bloqueada."
					value={profile.discreetMode}
					onValueChange={onToggleDiscreet}
				/>
				<PermissionsCard />
			</View>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
					Google Agenda
				</Text>
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					Envie os blocos da sua rotina como eventos para a agenda do aparelho,
					que o Android sincroniza com o Google Agenda.
				</Text>
				<ActionButton
					title="Abrir integração com a agenda"
					variant="secondary"
					onPress={() => router.push("/calendar")}
				/>
			</View>

			<View
				style={[
					styles.card,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
					Importar e backup
				</Text>
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					Importe um arquivo .db com a sua rotina, tarefas e metas semanais, ou
					faça um backup de tudo em um único arquivo.
				</Text>
				<ActionButton
					title="Abrir importação e backup"
					variant="secondary"
					onPress={() => router.push("/data")}
				/>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.md, padding: spacing.md },
	greeting: {
		fontSize: fontSize.title,
		fontWeight: fontWeight.bold,
		paddingVertical: spacing.sm,
	},
	card: {
		gap: spacing.md,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
	},
	sectionTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
	hint: { fontSize: fontSize.caption, lineHeight: 18 },
});
