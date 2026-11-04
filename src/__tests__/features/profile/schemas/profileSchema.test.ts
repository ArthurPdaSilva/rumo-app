import {
	onboardingFormSchema,
	profileFormSchema,
} from "../../../../features/profile/schemas/profileSchema";

describe("onboardingFormSchema", () => {
	test("aceita e apara um nome válido", () => {
		const result = onboardingFormSchema.safeParse({ username: "  Arthur  " });

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.username).toBe("Arthur");
	});

	test("recusa nome curto com mensagem em português", () => {
		const result = onboardingFormSchema.safeParse({ username: " A " });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Use pelo menos 2 caracteres",
			);
		}
	});

	test("recusa nome muito longo", () => {
		const result = onboardingFormSchema.safeParse({ username: "a".repeat(25) });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Use no máximo 24 caracteres",
			);
		}
	});
});

describe("profileFormSchema", () => {
	test.each(["00:00", "08:30", "23:59"])("aceita o horário %s", (time) => {
		const result = profileFormSchema.safeParse({
			username: "Arthur",
			dailyMessageTime: time,
		});

		expect(result.success).toBe(true);
	});

	test.each(["24:00", "8:30", "12:60", "abc", ""])(
		"recusa o horário %p",
		(time) => {
			const result = profileFormSchema.safeParse({
				username: "Arthur",
				dailyMessageTime: time,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(
					"Use o formato HH:MM, como 08:30",
				);
			}
		},
	);
});
