import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { toastConfig } from "@/components/notifications";
import { DATABASE_NAME, initializeDatabase } from "@/database/client";
import { useThemeColors } from "@/styles/theme";

export default function RootLayout() {
	const colors = useThemeColors();
	const headerOptions = {
		headerShown: true,
		headerStyle: { backgroundColor: colors.surface },
		headerTintColor: colors.textPrimary,
	};

	return (
		<SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
			<StatusBar style="auto" />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen
					name="addictions/new"
					options={{ ...headerOptions, title: "Novo vício" }}
				/>
				<Stack.Screen
					name="addictions/[id]"
					options={{ ...headerOptions, title: "Vício" }}
				/>
				<Stack.Screen
					name="blocks/new"
					options={{ ...headerOptions, title: "Novo bloco" }}
				/>
				<Stack.Screen
					name="blocks/[id]"
					options={{ ...headerOptions, title: "Editar bloco" }}
				/>
				<Stack.Screen
					name="data"
					options={{ ...headerOptions, title: "Importar e backup" }}
				/>
			</Stack>
			<Toast config={toastConfig} />
		</SQLiteProvider>
	);
}
