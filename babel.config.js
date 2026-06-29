module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 / react-native-worklets: bắt buộc cho worklets (Sortable, v.v.).
  // PHẢI là plugin cuối cùng trong danh sách.
  plugins: ['react-native-worklets/plugin'],
};
