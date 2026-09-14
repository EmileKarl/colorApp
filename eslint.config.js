const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    // `.claude/skills` holds third-party skill packages (bundled minified JS,
    // Python and CJS scripts). They are tooling for the assistant, not part of
    // the app, and linting them under this project's rules produces dozens of
    // failures that say nothing about ColorLens.
    ignores: ["dist/*", "node_modules/*", ".expo/*", ".claude/*"],
  },
];
