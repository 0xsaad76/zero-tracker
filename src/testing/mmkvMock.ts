/**
 * Runner-agnostic mock for `react-native-mmkv` (no native runtime in tests).
 * In-memory map so code that writes then reads behaves realistically.
 * Used by jest.setup.js (jest.mock) and bun-preload.ts (mock.module).
 */

type Stored = string | number | boolean;

export const createMMKV = () => {
  const store = new Map<string, Stored>();
  const listeners = new Set<(key: string) => void>();
  return {
    addOnValueChangedListener: (listener: (key: string) => void) => {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
    set: (key: string, value: Stored) => {
      store.set(key, value);
      listeners.forEach(listener => listener(key));
    },
    getString: (key: string) => {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getBoolean: (key: string) => {
      const value = store.get(key);
      return typeof value === 'boolean' ? value : false;
    },
    getNumber: (key: string) => {
      const value = store.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    remove: (key: string) => {
      store.delete(key);
      listeners.forEach(listener => listener(key));
    },
    contains: (key: string) => store.has(key),
    clearAll: () => {
      store.clear();
    },
    getAllKeys: () => Array.from(store.keys()),
  };
};
