import {
	StyleSheet,
	Text,
	TextInput,
	type TextInputProps,
	View,
} from "react-native";
import { useThemeColors } from "@/styles/theme";
import { borderRadius, fontSize, fontWeight, spacing } from "@/styles/tokens";

interface TextFieldProps extends TextInputProps {
	label: string;
	error?: string;
}

export function TextField({
	label,
	error,
	style,
	...inputProps
}: TextFieldProps) {
	const colors = useThemeColors();

	return (
		<View style={styles.container}>
			<Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				placeholderTextColor={colors.textMuted}
				{...inputProps}
				style={[
					styles.input,
					{
						backgroundColor: colors.surface,
						borderColor: error ? colors.danger : colors.border,
						color: colors.textPrimary,
					},
					style,
				]}
			/>
			{error ? (
				<Text
					accessibilityRole="alert"
					style={[styles.error, { color: colors.danger }]}
				>
					{error}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { gap: spacing.xs },
	label: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
	input: {
		minHeight: 48,
		borderWidth: 1,
		borderRadius: borderRadius.md,
		paddingHorizontal: spacing.md,
		fontSize: fontSize.body,
	},
	error: { fontSize: fontSize.caption },
});
