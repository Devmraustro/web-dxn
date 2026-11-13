module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src/backend/ai"],
  testMatch: ["<rootDir>/src/backend/ai/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/backend/ai/tests/envSetup.js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/src/backend/ai/tsconfig.test.json" }],
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
