/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Keep module relationships acyclic so changes remain predictable.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-production-to-tests",
      severity: "error",
      comment: "Production modules must not depend on co-located test modules.",
      from: {
        path: "^src/",
        pathNot: "[.](?:spec|test)[.](?:js|jsx|mjs|cjs)$",
      },
      to: { path: "[.](?:spec|test)[.](?:js|jsx|mjs|cjs)$" },
    },
    {
      name: "ui-stays-feature-agnostic",
      severity: "error",
      comment: "Reusable UI primitives must not reach into feature or mock layers.",
      from: { path: "^src/ui/" },
      to: { path: "^src/(?:features|mock)/" },
    },
    {
      name: "mocks-stay-ui-agnostic",
      severity: "error",
      comment: "Mock data and contracts must not depend on UI or feature modules.",
      from: { path: "^src/mock/" },
      to: { path: "^src/(?:ui|features)/" },
    },
    {
      name: "features-do-not-import-app-shell",
      severity: "error",
      comment: "Feature modules must not depend back on top-level application modules.",
      from: { path: "^src/features/" },
      to: { path: "^src/[^/]+[.](?:js|jsx|mjs|cjs)$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    includeOnly: "^src/",
    moduleSystems: ["cjs", "es6"],
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
    skipAnalysisNotInRules: true,
  },
};
