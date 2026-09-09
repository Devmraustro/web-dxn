/**
 * Fast unit-test config for pure (DB-independent) suites such as the
 * AI safety-guard test. Uses ts-jest with isolatedModules (transpile-only)
 * so pure unit tests can verify runtime behaviour quickly without either
 * full-project type-checking or a MongoDB dependency. Full type-safety is
 * still enforced by the repository-wide `npm run typecheck`.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/backend/tests"],
  testMatch: [
    "<rootDir>/src/backend/tests/ai-guardrail.test.ts",
    "<rootDir>/src/backend/tests/security-fixes-v2.test.ts",
    "<rootDir>/src/backend/tests/commerce-unit.test.ts",
  ],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2020",
          module: "CommonJS",
          lib: ["ES2020"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          isolatedModules: true,
          moduleResolution: "node",
          types: ["node", "jest"],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
