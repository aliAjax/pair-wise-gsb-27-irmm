// 存取：localStorage 读写，键位与旧试算器分开，损坏时回退种子资料

import { buildSeedState } from "../domain/seed";
import type { AllocationSheet, Quote } from "../domain/types";

export const STORAGE_KEY = "hxwlfront-13-allocation";

export interface PersistedState {
  quotes: Quote[];
  sheets: AllocationSheet[];
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(parsed.quotes) || !Array.isArray(parsed.sheets)) {
      return buildSeedState();
    }
    return { quotes: parsed.quotes, sheets: parsed.sheets };
  } catch {
    return buildSeedState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 本地存储不可用时静默失败，页面内数据仍可用
  }
}
