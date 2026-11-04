import { fireEvent, render, screen } from "@testing-library/react-native";
import { AddictionCard } from "../../../../features/addictions/components/AddictionCard";
import type { Addiction } from "../../../../types";

const addiction: Addiction = {
	id: 1,
	name: "Cigarro",
	icon: "smoking",
	quitAt: "2026-10-25T12:00:00.000Z",
	createdAt: "2026-11-01T12:00:00.000Z",
	streakStartedAt: "2026-10-25T12:00:00.000Z",
	archivedAt: null,
};

describe("AddictionCard", () => {
	test("mostra o nome e o tempo sem ceder", async () => {
		await render(
			<AddictionCard
				addiction={addiction}
				now={new Date("2026-11-04T12:00:00.000Z")}
				onPress={jest.fn()}
			/>,
		);

		expect(screen.getByText("Cigarro")).toBeTruthy();
		expect(screen.getByLabelText("Cigarro, 10 dias sem ceder")).toBeTruthy();
	});

	test("chama onPress ao tocar", async () => {
		const onPress = jest.fn();
		await render(
			<AddictionCard
				addiction={addiction}
				now={new Date("2026-11-04T12:00:00.000Z")}
				onPress={onPress}
			/>,
		);

		await fireEvent.press(screen.getByText("Cigarro"));

		expect(onPress).toHaveBeenCalledTimes(1);
	});
});
