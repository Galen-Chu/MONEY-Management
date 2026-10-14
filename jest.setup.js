/* Jest 全域設定:AsyncStorage 官方 mock(zustand persist 於 Node/jsdom 環境需要)。 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
