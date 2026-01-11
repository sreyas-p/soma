module.exports = {
  dependencies: {
    '@kingstinct/react-native-healthkit': {
      platforms: {
        android: null, // Disable on Android - HealthKit is iOS only
      },
    },
  },
};
