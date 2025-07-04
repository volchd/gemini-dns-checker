module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	transform: {
		"^.+\.ts?$": "ts-jest",
	},
	moduleNameMapper: {
		'^(\\.\\.?/.*)\\.js$': '$1',
	},
	testMatch: [
		"<rootDir>/tests/**/*.test.ts"
	],
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts"
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
};