jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  DownloadDirectoryPath: '/tmp/downloads',
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  types: {allFiles: 'public.item'},
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Shared runner-agnostic mocks (also registered by bun-preload.ts for `bun test`)
jest.mock('react-native-localize', () => require('./src/testing/localizeMock'));
jest.mock('react-native-mmkv', () => require('./src/testing/mmkvMock'));
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly'},
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({type: 'cancelled'})),
    addScopes: jest.fn(async () => ({type: 'cancelled'})),
    signInSilently: jest.fn(async () => ({type: 'noSavedCredentialFound'})),
    getTokens: jest.fn(),
    signOut: jest.fn(async () => undefined),
    revokeAccess: jest.fn(async () => undefined),
    clearCachedAccessToken: jest.fn(async () => undefined),
  },
  isSuccessResponse: response => response.type === 'success',
}));
