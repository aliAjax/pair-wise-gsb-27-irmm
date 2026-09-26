/**
 * 分摊单版本链规则(纯函数):
 * - 确认:同一报价只留一张"当前"分摊单,旧当前版转为历史;
 * - 撤回:仅"当前且未发出"的版本可撤回,撤回后上一版重新成为当前;
 * - 发出:当前版标记发出时间,已发出不可撤回;
 * - 已确认的分摊单一律不改,只能复制成新版本再确认。
 */
import type { AllocationSheet } from "../types";

export function sheetsOfQuote(sheets: AllocationSheet[], quoteId: string): AllocationSheet[] {
  return sheets.filter((s) => s.quoteId === quoteId).sort((a, b) => a.version - b.version);
}

export function currentSheetOf(
  sheets: AllocationSheet[],
  quoteId: string
): AllocationSheet | null {
  return sheets.find((s) => s.quoteId === quoteId && s.status === "current") ?? null;
}

export function nextVersion(sheets: AllocationSheet[], quoteId: string): number {
  const versions = sheetsOfQuote(sheets, quoteId).map((s) => s.version);
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

/** 确认新版本:旧当前版转为历史,只留新单为当前 */
export function applyConfirm(sheets: AllocationSheet[], sheet: AllocationSheet): AllocationSheet[] {
  const demoted = sheets.map((s) =>
    s.quoteId === sheet.quoteId && s.status === "current" ? { ...s, status: "history" as const } : s
  );
  return [...demoted, sheet];
}

/** 仅当前且未发出的版本可撤回 */
export function canWithdraw(sheet: AllocationSheet): boolean {
  return sheet.status === "current" && sheet.sentAt === null;
}

/** 撤回后,版本号最大的历史版重新成为当前结果 */
export function applyWithdraw(
  sheets: AllocationSheet[],
  sheetId: string,
  now: string
): AllocationSheet[] {
  const target = sheets.find((s) => s.id === sheetId);
  if (!target || !canWithdraw(target)) return sheets;
  const previous = sheetsOfQuote(sheets, target.quoteId)
    .filter((s) => s.version < target.version && s.status === "history")
    .sort((a, b) => b.version - a.version)[0];
  return sheets.map((s) => {
    if (s.id === target.id) return { ...s, status: "withdrawn" as const, withdrawnAt: now };
    if (previous && s.id === previous.id) return { ...s, status: "current" as const };
    return s;
  });
}

/** 标记已发出(仅当前版);已发出的版本不允许再撤回 */
export function applySend(sheets: AllocationSheet[], sheetId: string, now: string): AllocationSheet[] {
  return sheets.map((s) =>
    s.id === sheetId && s.status === "current" && s.sentAt === null ? { ...s, sentAt: now } : s
  );
}
