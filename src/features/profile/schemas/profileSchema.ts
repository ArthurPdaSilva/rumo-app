import { z } from "zod";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/types";

export const usernameSchema = z
	.string()
	.trim()
	.min(USERNAME_MIN_LENGTH, `Use pelo menos ${USERNAME_MIN_LENGTH} caracteres`)
	.max(USERNAME_MAX_LENGTH, `Use no máximo ${USERNAME_MAX_LENGTH} caracteres`);

export const dailyMessageTimeSchema = z
	.string()
	.trim()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM, como 08:30");

export const onboardingFormSchema = z.object({ username: usernameSchema });

export const profileFormSchema = z.object({
	username: usernameSchema,
	dailyMessageTime: dailyMessageTimeSchema,
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
