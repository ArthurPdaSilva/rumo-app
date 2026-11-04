import { render, screen } from "@testing-library/react-native";
import { ScreenPlaceholder } from "../../components/ScreenPlaceholder";

describe("ScreenPlaceholder", () => {
	test("mostra título e descrição", async () => {
		await render(
			<ScreenPlaceholder
				icon="timer-outline"
				title="Em breve"
				description="Esta tela ainda será construída."
			/>,
		);

		expect(screen.getByText("Em breve")).toBeTruthy();
		expect(screen.getByText("Esta tela ainda será construída.")).toBeTruthy();
	});
});
