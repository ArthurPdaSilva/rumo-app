/** @type {import('jest').Config} */
module.exports = {
	preset: "jest-expo",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
	},
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"!src/__tests__/**",
		"!src/app/**",
	],
	testPathIgnorePatterns: [
		"/node_modules/",
		"/_to_delete/",
		"/src/__tests__/helpers/",
	],
	setupFiles: ["./jest.setup.js"],
};
