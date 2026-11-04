jest.mock("react-native-toast-message", () => {
	const Toast = () => null;
	Toast.show = jest.fn();
	return { __esModule: true, default: Toast };
});

jest.mock("@expo/vector-icons", () => {
	const Icon = () => null;
	return { MaterialCommunityIcons: Icon };
});
