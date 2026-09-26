// 状态与动作：报价登记、重算、确认、版本复制、发出、撤回、线路核账

import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { computeAllocation, fingerprintOf } from "../domain/allocation";
import { loadState, saveState } from "../storage/repository";
import type { AllocationRow, AllocationSheet, Quote } from "../domain/types";

export type PageKey = "quotes" | "sheets" | "reconcile";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface ReconcileQuoteRow {
  quoteId: string;
  createdAt: string;
  consigneeCount: number;
  recordedTotalCents: number;
  version: number | null;
  statusLabel: string;
  sheetTotalCents: number;
  allocatedCents: number;
  diffCents: number;
  flag: "未确认" | "改后未确认" | "已对平";
}

export interface ReconcileRouteRow {
  route: string;
  quoteCount: number;
  confirmedCount: number;
  sheetTotalCents: number;
  allocatedCents: number;
  diffCents: number;
  rows: ReconcileQuoteRow[];
}

export const useAllocationStore = defineStore("allocation", () => {
  const persisted = loadState();
  const quotes = ref<Quote[]>(persisted.quotes);
  const sheets = ref<AllocationSheet[]>(persisted.sheets);
  const activePage = ref<PageKey>("quotes");
  const selectedQuoteId = ref<string | null>(quotes.value[0]?.id ?? null);
  const notice = ref<ActionResult | null>(null);

  // 任何状态变化都同步落盘，重开页面可继续核账
  watch(
    [quotes, sheets],
    () => saveState({ quotes: quotes.value, sheets: sheets.value }),
    { deep: true, flush: "sync" }
  );

  function done(result: ActionResult): ActionResult {
    notice.value = result;
    return result;
  }

  const ok = (message: string): ActionResult => done({ ok: true, message });
  const fail = (message: string): ActionResult => done({ ok: false, message });

  // —— 查询 ——

  function findQuote(quoteId: string): Quote | undefined {
    return quotes.value.find((quote) => quote.id === quoteId);
  }

  function sheetsOf(quoteId: string): AllocationSheet[] {
    return sheets.value
      .filter((sheet) => sheet.quoteId === quoteId)
      .sort((a, b) => b.version - a.version);
  }

  function currentSheetOf(quoteId: string): AllocationSheet | null {
    const quote = findQuote(quoteId);
    if (!quote?.currentSheetId) return null;
    return sheets.value.find((sheet) => sheet.id === quote.currentSheetId) ?? null;
  }

  // 资料改过就要先重算：当前资料指纹与上次重算指纹不一致即为过期
  function isStale(quote: Quote): boolean {
    return !quote.preview || fingerprintOf(quote) !== quote.computedFingerprint;
  }

  function nextVersion(quoteId: string): number {
    return sheetsOf(quoteId).reduce((max, sheet) => Math.max(max, sheet.version), 0) + 1;
  }

  function canConfirm(quote: Quote): boolean {
    if (!quote.preview || isStale(quote)) return false;
    const current = currentSheetOf(quote.id);
    // 同一报价重复确认只留一张：与当前单一致时禁止再确认
    return !(current && current.inputFingerprint === fingerprintOf(quote));
  }

  function confirmHint(quote: Quote): string {
    if (!quote.preview) return "请先重算分摊";
    if (isStale(quote)) return "资料已修改，请先重算";
    const current = currentSheetOf(quote.id);
    if (current && current.inputFingerprint === fingerprintOf(quote)) {
      return `与当前 v${current.version} 一致，同一报价只保留一张分摊单`;
    }
    return current
      ? `确认后生成 v${nextVersion(quote.id)} 并替换当前 v${current.version}`
      : "确认后生成 v1";
  }

  function sheetBadge(sheet: AllocationSheet): { label: string; tone: "current" | "history" | "withdrawn" } {
    if (sheet.status === "withdrawn") return { label: "已撤回", tone: "withdrawn" };
    const base = sheet.status === "sent" ? "已发出" : "已确认";
    const isCurrent = findQuote(sheet.quoteId)?.currentSheetId === sheet.id;
    return isCurrent ? { label: `当前 · ${base}`, tone: "current" } : { label: `历史 · ${base}`, tone: "history" };
  }

  // —— 报价登记 ——

  function addQuote(input: { route: string; totalFreightCents: number; note: string }): ActionResult {
    const route = input.route.trim();
    if (!route) return fail("请填写运输线路");
    if (!Number.isFinite(input.totalFreightCents) || input.totalFreightCents <= 0) {
      return fail("总运费必须大于 0");
    }
    const quote: Quote = {
      id: crypto.randomUUID(),
      route,
      totalFreightCents: input.totalFreightCents,
      consignees: [{ id: crypto.randomUUID(), name: "", weightKg: 0, volumeM3: 0 }],
      note: input.note.trim(),
      createdAt: new Date().toISOString(),
      currentSheetId: null,
      computedFingerprint: null,
      preview: null,
    };
    quotes.value.unshift(quote);
    selectedQuoteId.value = quote.id;
    return ok(`已登记报价「${route}」，请补充收货人后重算`);
  }

  function removeQuote(quoteId: string): ActionResult {
    quotes.value = quotes.value.filter((quote) => quote.id !== quoteId);
    sheets.value = sheets.value.filter((sheet) => sheet.quoteId !== quoteId);
    if (selectedQuoteId.value === quoteId) {
      selectedQuoteId.value = quotes.value[0]?.id ?? null;
    }
    return ok("报价及其分摊单已删除");
  }

  function addConsignee(quoteId: string): void {
    const quote = findQuote(quoteId);
    if (!quote) return;
    quote.consignees.push({ id: crypto.randomUUID(), name: "", weightKg: 0, volumeM3: 0 });
  }

  function removeConsignee(quoteId: string, consigneeId: string): void {
    const quote = findQuote(quoteId);
    if (!quote) return;
    quote.consignees = quote.consignees.filter((item) => item.id !== consigneeId);
  }

  // —— 分摊流转 ——

  function recomputeQuote(quoteId: string): ActionResult {
    const quote = findQuote(quoteId);
    if (!quote) return fail("报价不存在");
    const result = computeAllocation(quote);
    if (!result.ok) {
      quote.preview = null;
      quote.computedFingerprint = null;
      return fail(result.error);
    }
    quote.preview = result.rows;
    quote.computedFingerprint = fingerprintOf(quote);
    return ok(`已重算：计费重合计 ${result.totalChargeableKg.toFixed(2)} kg，待确认`);
  }

  function confirmQuote(quoteId: string): ActionResult {
    const quote = findQuote(quoteId);
    if (!quote) return fail("报价不存在");
    if (!quote.preview || isStale(quote)) return fail("资料已变更，请先重算再确认");
    const fingerprint = fingerprintOf(quote);
    const current = currentSheetOf(quoteId);
    if (current && current.inputFingerprint === fingerprint) {
      return fail(`与当前 v${current.version} 一致，同一报价只保留一张分摊单`);
    }
    // 深拷贝快照，与响应式预览解耦（行数据为纯数据，JSON 拷贝即可）
    const rows = JSON.parse(JSON.stringify(quote.preview)) as AllocationRow[];
    const sheet: AllocationSheet = {
      id: crypto.randomUUID(),
      quoteId,
      version: nextVersion(quoteId),
      status: "confirmed",
      route: quote.route.trim(),
      totalFreightCents: quote.totalFreightCents,
      rows,
      allocatedCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
      inputFingerprint: fingerprint,
      createdAt: new Date().toISOString(),
      sentAt: null,
      withdrawnAt: null,
    };
    sheets.value.push(sheet);
    quote.currentSheetId = sheet.id; // 上一版自动转为历史，仍可查
    return ok(`已确认 v${sheet.version}，成为当前分摊单`);
  }

  // 已确认的单据不可改，只能复制成新版本草稿，改完先重算再确认
  function copySheetAsDraft(sheetId: string): ActionResult {
    const sheet = sheets.value.find((item) => item.id === sheetId);
    if (!sheet) return fail("分摊单不存在");
    const quote = findQuote(sheet.quoteId);
    if (!quote) return fail("报价不存在");
    quote.route = sheet.route;
    quote.totalFreightCents = sheet.totalFreightCents;
    quote.consignees = sheet.rows.map((row) => ({
      id: crypto.randomUUID(),
      name: row.name,
      weightKg: row.weightKg,
      volumeM3: row.volumeM3,
    }));
    quote.preview = null;
    quote.computedFingerprint = null;
    selectedQuoteId.value = quote.id;
    activePage.value = "quotes";
    return ok(`已把 v${sheet.version} 复制为草稿，修改后请先重算`);
  }

  function sendSheet(sheetId: string): ActionResult {
    const sheet = sheets.value.find((item) => item.id === sheetId);
    if (!sheet) return fail("分摊单不存在");
    const quote = findQuote(sheet.quoteId);
    if (!quote || quote.currentSheetId !== sheet.id) return fail("只能发出当前分摊单");
    if (sheet.status !== "confirmed") return fail("只有已确认未发出的分摊单才能发出");
    sheet.status = "sent";
    sheet.sentAt = new Date().toISOString();
    return ok(`v${sheet.version} 已发出，发出后不可撤回`);
  }

  // 撤回未发出的当前版本，上一版重新成为当前结果
  function withdrawSheet(sheetId: string): ActionResult {
    const sheet = sheets.value.find((item) => item.id === sheetId);
    if (!sheet) return fail("分摊单不存在");
    const quote = findQuote(sheet.quoteId);
    if (!quote || quote.currentSheetId !== sheet.id) return fail("只能撤回当前分摊单");
    if (sheet.status !== "confirmed") return fail("已发出的分摊单不能撤回");
    sheet.status = "withdrawn";
    sheet.withdrawnAt = new Date().toISOString();
    const previous = sheets.value
      .filter(
        (item) =>
          item.quoteId === sheet.quoteId && item.status !== "withdrawn" && item.version < sheet.version
      )
      .sort((a, b) => b.version - a.version)[0];
    quote.currentSheetId = previous?.id ?? null;
    return ok(
      previous
        ? `已撤回 v${sheet.version}，v${previous.version} 重新成为当前结果`
        : `已撤回 v${sheet.version}，当前无生效分摊单`
    );
  }

  // —— 按线路核账 ——

  const reconcileByRoute = computed<ReconcileRouteRow[]>(() => {
    const groups = new Map<string, ReconcileRouteRow>();
    for (const quote of quotes.value) {
      const current = currentSheetOf(quote.id);
      const changed = current ? current.inputFingerprint !== fingerprintOf(quote) : false;
      const row: ReconcileQuoteRow = {
        quoteId: quote.id,
        createdAt: quote.createdAt,
        consigneeCount: quote.consignees.filter((item) => item.name.trim()).length,
        recordedTotalCents: quote.totalFreightCents,
        version: current?.version ?? null,
        statusLabel: current ? sheetBadge(current).label : "未确认",
        sheetTotalCents: current?.totalFreightCents ?? 0,
        allocatedCents: current?.allocatedCents ?? 0,
        diffCents: current ? current.totalFreightCents - current.allocatedCents : 0,
        flag: !current ? "未确认" : changed ? "改后未确认" : "已对平",
      };
      let group = groups.get(quote.route);
      if (!group) {
        group = {
          route: quote.route,
          quoteCount: 0,
          confirmedCount: 0,
          sheetTotalCents: 0,
          allocatedCents: 0,
          diffCents: 0,
          rows: [],
        };
        groups.set(quote.route, group);
      }
      group.quoteCount += 1;
      if (current) {
        group.confirmedCount += 1;
        group.sheetTotalCents += current.totalFreightCents;
        group.allocatedCents += current.allocatedCents;
        group.diffCents += current.totalFreightCents - current.allocatedCents;
      }
      group.rows.push(row);
    }
    return [...groups.values()].sort((a, b) => a.route.localeCompare(b.route, "zh"));
  });

  return {
    quotes,
    sheets,
    activePage,
    selectedQuoteId,
    notice,
    findQuote,
    sheetsOf,
    currentSheetOf,
    isStale,
    canConfirm,
    confirmHint,
    sheetBadge,
    addQuote,
    removeQuote,
    addConsignee,
    removeConsignee,
    recomputeQuote,
    confirmQuote,
    copySheetAsDraft,
    sendSheet,
    withdrawSheet,
    reconcileByRoute,
  };
});
