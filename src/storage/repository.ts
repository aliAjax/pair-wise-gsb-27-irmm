/** 存取层:localStorage 读写,首次打开播种演示资料 */
import { buildSeedBook, type Book } from "../data/seed";

const STORAGE_KEY = "hxwlfront-13-allocation";

export type { Book };

export function loadBook(): Book {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Book>;
      if (Array.isArray(parsed.quotes) && Array.isArray(parsed.sheets)) {
        return { quotes: parsed.quotes, sheets: parsed.sheets };
      }
    }
  } catch {
    // 数据损坏时回退到演示资料
  }
  return buildSeedBook();
}

export function saveBook(book: Book): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
}
