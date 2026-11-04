import { render, screen } from "@testing-library/react-native";
import { FocusScreen } from "../../features/focus/screens/FocusScreen";
import { RoutineScreen } from "../../features/routine/screens/RoutineScreen";

describe("telas iniciais", () => {
	test.each([
		["Rotina", RoutineScreen],
		["Foco", FocusScreen],
	] as const)("%s mostra o título", async (title, Screen) => {
		await render(<Screen />);

		expect(screen.getByText(title)).toBeTruthy();
	});
});
