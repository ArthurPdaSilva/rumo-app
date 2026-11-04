import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { ADDICTION_ICONS, type AddictionIcon } from "@/types";

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Garante um ícone conhecido mesmo se o valor salvo for desconhecido. */
export function toAddictionIcon(icon: string): AddictionIcon {
	return (ADDICTION_ICONS as readonly string[]).includes(icon)
		? (icon as AddictionIcon)
		: "leaf";
}
