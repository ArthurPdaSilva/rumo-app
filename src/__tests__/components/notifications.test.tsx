import Toast from "react-native-toast-message";
import { notification } from "../../components/notifications";

describe("notification", () => {
	beforeEach(() => {
		(Toast.show as jest.Mock).mockClear();
	});

	test.each([
		["success", "Sucesso"],
		["error", "Erro"],
		["info", "Aviso"],
	] as const)("exibe toast de %s", (type, title) => {
		notification[type]("Mensagem de teste");

		expect(Toast.show).toHaveBeenCalledWith({
			type,
			text1: title,
			text2: "Mensagem de teste",
			position: "top",
			visibilityTime: 3500,
			topOffset: 56,
		});
	});
});
