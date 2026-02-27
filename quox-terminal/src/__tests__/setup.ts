import '@testing-library/jest-dom';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock Tauri APIs for test environment
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

// Mock store
vi.mock('../lib/store', () => ({
  storeGet: vi.fn().mockResolvedValue(null),
  storeSet: vi.fn().mockResolvedValue(undefined),
}));
