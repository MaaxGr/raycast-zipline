import raycastConfig from "@raycast/eslint-config";

// Flatten the config because raycastConfig contains nested arrays
const flatConfig = raycastConfig.flat();

export default [
  ...flatConfig,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
