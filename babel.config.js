module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'babel-plugin-module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
          },
        },
      ],
      // Must be LAST (per Reanimated docs)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        // Keep Reanimated plugin enabled in production; it must remain last.
        plugins: ['transform-remove-console', 'react-native-reanimated/plugin']
      }
    }
  };
}; 