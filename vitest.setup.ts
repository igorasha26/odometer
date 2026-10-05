import 'fake-indexeddb/auto';

// jsdom не реализует ни то, ни другое, а приложение опирается на оба.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, randomUUID: () => Math.random().toString(36).slice(2) + Date.now() },
  });
}
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}
