export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
} as const;

export const borderRadius = {
	sm: 8,
	md: 12,
	lg: 20,
	pill: 999,
} as const;

export const fontSize = {
	caption: 13,
	body: 16,
	title: 22,
	display: 34,
} as const;

export const fontWeight = {
	regular: "400",
	medium: "500",
	bold: "700",
} as const;

export const lightColors = {
	background: "#F6FAF9",
	surface: "#FFFFFF",
	border: "#D5E3E0",
	textPrimary: "#10302C",
	textMuted: "#5B7470",
	primary: "#0F766E",
	success: "#15803D",
	danger: "#B91C1C",
	shadow: "#000000",
} as const;

export const darkColors = {
	background: "#0B1715",
	surface: "#12231F",
	border: "#24403B",
	textPrimary: "#E6F2EF",
	textMuted: "#93ADA8",
	primary: "#2DD4BF",
	success: "#4ADE80",
	danger: "#F87171",
	shadow: "#000000",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };
