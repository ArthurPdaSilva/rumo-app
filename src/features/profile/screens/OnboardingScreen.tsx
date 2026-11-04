import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Controller, useForm } from "react-hook-form";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
} from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { notification } from "@/components/notifications";
import { TextField } from "@/components/TextField";
import {
	type OnboardingFormValues,
	onboardingFormSchema,
} from "@/features/profile/schemas/profileSchema";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";
import { useThemeColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/tokens";

export function OnboardingScreen() {
	const db = useSQLiteContext();
	const router = useRouter();
	const colors = useThemeColors();
	const saveDetails = useProfileStore((state) => state.saveDetails);
	const {
		control,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<OnboardingFormValues>({
		resolver: zodResolver(onboardingFormSchema),
		defaultValues: { username: "" },
	});

	async function onSubmit(values: OnboardingFormValues) {
		try {
			await saveDetails(db, { username: values.username });
			notification.success(`Bem-vindo, ${values.username}!`);
			router.replace("/");
		} catch {
			notification.error(
				"Não foi possível salvar o seu nome. Tente novamente.",
			);
		}
	}

	return (
		<KeyboardAvoidingView
			style={[styles.flex, { backgroundColor: colors.background }]}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					Bem-vindo ao Rumo
				</Text>
				<Text style={[styles.description, { color: colors.textMuted }]}>
					Tudo fica só no seu aparelho, sem conta nem internet. Escolha o nome
					que vai aparecer nas suas notificações.
				</Text>
				<Controller
					control={control}
					name="username"
					render={({ field }) => (
						<TextField
							label="Nome de usuário"
							placeholder="Como quer ser chamado?"
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
				<ActionButton
					title="Começar"
					disabled={isSubmitting}
					onPress={handleSubmit(onSubmit)}
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: {
		flexGrow: 1,
		justifyContent: "center",
		gap: spacing.lg,
		padding: spacing.lg,
	},
	title: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
	description: { fontSize: fontSize.body, lineHeight: 24 },
});
