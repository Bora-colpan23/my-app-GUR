module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4'te worklet eklentisi react-native-worklets'ten geliyor;
    // eski 'react-native-reanimated/plugin' artık yok. LİSTENİN SONUNDA
    // olmak zorunda.
    plugins: ['react-native-worklets/plugin'],
  };
};
