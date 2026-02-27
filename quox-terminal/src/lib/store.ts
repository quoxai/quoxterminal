/**
 * store.ts — Tauri Store wrapper (replaces localStorage for persistence)
 *
 * Uses @tauri-apps/plugin-store for native key-value storage.
 * Falls back to localStorage during development without Tauri.
 */

import { load, type Store } from "@tauri-apps/plugin-store";

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load("quox-terminal-settings.json", {
      defaults: {},
      autoSave: true,
    });
  }
  return storeInstance;
}

/** Get a value from the persistent store. */
export async function storeGet<T>(key: string): Promise<T | null> {
  try {
    const store = await getStore();
    const val = await store.get<T>(key);
    return val ?? null;
  } catch {
    // Fallback to localStorage when not in Tauri
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

/** Set a value in the persistent store. */
export async function storeSet<T>(key: string, value: T): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded */
    }
  }
}

/** Delete a key from the persistent store. */
export async function storeDelete(key: string): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(key);
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
