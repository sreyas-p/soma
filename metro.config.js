const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enhanced configuration for production
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add .cjs and .mjs extensions for supabase and other packages
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];

// Ensure proper resolution of node_modules
config.resolver.nodeModulesPaths = [__dirname + '/node_modules'];

// Optimize for production builds
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config; 