// Explicit Babel config. `babel-preset-expo` is what Metro falls back to when
// no config file exists, so the app built without this file — but Reanimated 4
// needs the `react-native-worklets` plugin, which the preset only injects when
// it can see the project's own configuration. Declaring the preset here makes
// that injection deterministic instead of dependent on Metro's fallback.
module.exports = function babelConfig(api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
