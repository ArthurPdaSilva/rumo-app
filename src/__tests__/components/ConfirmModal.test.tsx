import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ConfirmModal } from "../../components/ConfirmModal";

function setup(visible = true) {
	const onConfirm = jest.fn();
	const onCancel = jest.fn();
	return {
		onConfirm,
		onCancel,
		element: (
			<ConfirmModal
				visible={visible}
				title="Excluir?"
				message="Isso não pode ser desfeito."
				confirmLabel="Excluir"
				onConfirm={onConfirm}
				onCancel={onCancel}
			>
				<Text>conteúdo extra</Text>
			</ConfirmModal>
		),
	};
}

describe("ConfirmModal", () => {
	test("mostra título, mensagem e conteúdo extra", async () => {
		await render(setup().element);

		expect(screen.getByText("Excluir?")).toBeTruthy();
		expect(screen.getByText("Isso não pode ser desfeito.")).toBeTruthy();
		expect(screen.getByText("conteúdo extra")).toBeTruthy();
	});

	test("confirmar e cancelar chamam os callbacks certos", async () => {
		const { element, onConfirm, onCancel } = setup();
		await render(element);

		await fireEvent.press(screen.getByText("Excluir"));
		await fireEvent.press(screen.getByText("Cancelar"));

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	test("não renderiza nada quando invisível", async () => {
		await render(setup(false).element);

		expect(screen.queryByText("Excluir?")).toBeNull();
	});
});
