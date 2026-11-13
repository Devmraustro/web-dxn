/**
 * Fast unit & DB-free integration test config covering:
 *  - Backend unit suites (commerce, SEO, security fixes, AI guardrails, launch prep, Telegram)
 *  - DB-free HTTP integration suites (Phase 23 product admin, DXN NADZ platform, Final Release Audit)
 *  - Frontend utility suites (cart reconciliation, language switcher, order flow)
 *
 * Full project-wide TypeScript type-checking is enforced separately by `npm run typecheck`.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: [
    "<rootDir>/src/backend/tests",
    "<rootDir>/src/frontend/src/utils",
    "<rootDir>/src/frontend/src/components",
  ],
  testMatch: [
    "<rootDir>/src/backend/tests/ai-guardrail.test.ts",
    "<rootDir>/src/backend/tests/security-fixes-v2.test.ts",
    "<rootDir>/src/backend/tests/commerce-unit.test.ts",
    "<rootDir>/src/backend/tests/launch-prep.test.ts",
    "<rootDir>/src/backend/tests/telegram.service.test.ts",
    "<rootDir>/src/backend/tests/phase23-product-admin.dbfree.test.ts",
    "<rootDir>/src/backend/tests/dxn-nadz-platform.dbfree.test.ts",
    "<rootDir>/src/backend/tests/final-release-audit.dbfree.test.ts",
    "<rootDir>/src/frontend/src/utils/*.test.ts",
    "<rootDir>/src/frontend/src/components/*.test.tsx",
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2020",
          module: "CommonJS",
          lib: ["ES2020", "DOM"],
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
  moduleFileExtensions: ["ts", "tsx", "js", "json", "node"],
};
