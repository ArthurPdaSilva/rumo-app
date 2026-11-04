import { Redirect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type ReactNode, useEffect } from "react";
import { notification } from "@/components/notifications";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";

interface ProfileGateProps {
	children: ReactNode;
}

/** Carrega o perfil e leva ao onboarding enquanto não houver nome de usuário. */
export function ProfileGate({ children }: ProfileGateProps) {
	const db = useSQLiteContext();
	const isLoaded = useProfileStore((state) => state.isLoaded);
	const profile = useProfileStore((state) => state.profile);
	const load = useProfileStore((state) => state.load);

	useEffect(() => {
		if (isLoaded) return;
		load(db).catch(() => {
			notification.error("Não foi possível carregar o seu perfil.");
		});
	}, [db, isLoaded, load]);

	if (!isLoaded) return null;
	if (!profile) return <Redirect href="/onboarding" />;

	return <>{children}</>;
}
