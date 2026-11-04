import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ProfileGate } from "@/features/profile/components/ProfileGate";
import { useThemeColors } from "@/styles/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
	{ name: "index", title: "Vícios", icon: "leaf" },
	{ name: "routine", title: "Rotina", icon: "calendar-clock" },
	{ name: "focus", title: "Foco", icon: "timer-outline" },
	{ name: "profile", title: "Perfil", icon: "account-circle-outline" },
];

export default function TabsLayout() {
	const colors = useThemeColors();

	return (
		<ProfileGate>
			<Tabs
				screenOptions={{
					headerStyle: { backgroundColor: colors.surface },
					headerTintColor: colors.textPrimary,
					tabBarActiveTintColor: colors.primary,
					tabBarInactiveTintColor: colors.textMuted,
					tabBarStyle: {
						backgroundColor: colors.surface,
						borderTopColor: colors.border,
					},
				}}
			>
				{TABS.map((tab) => (
					<Tabs.Screen
						key={tab.name}
						name={tab.name}
						options={{
							title: tab.title,
							tabBarIcon: ({ focused, size }) => (
								<MaterialCommunityIcons
									name={tab.icon}
									color={focused ? colors.primary : colors.textMuted}
									size={size}
								/>
							),
						}}
					/>
				))}
			</Tabs>
		</ProfileGate>
	);
}
