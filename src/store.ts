/** 状态与动作:页面只调这里,规则与存取不直接进组件 */
import { computed, reactive } from "vue";
import {
  buildAllocationLines,
  totalChargeableKg,
  yuanToCents,
} from "./domain/allocation";
import {
  applyConfirm,
  applySend,
  applyWithdraw,
  currentSheetOf,
  nextVersion,
  sheetsOfQuote,
} from "./domain/sheetBook";
import { loadBook, saveBook } from "./storage/repository";
import type {
  AllocationDraft,
  AllocationSheet,
  Consignee,
  Quote,
} from "./types";

const book = loadBook();

const state = reactive({
  quotes: book.quotes,
  sheets: book.sheets,
  draft: null as AllocationDraft | null,
  routeFilter: "全部线路",
  lastConfirmedSheetId: null as string | null,
});

function persist() {
  saveBook({ quotes: state.quotes, sheets: state.sheets });
}

function quoteOf(quoteId: string): Quote | null {
  return state.quotes.find((q) => q.id === quoteId) ?? null;
}

const routes = computed(() => {
  const set = new Set<string>();
  state.quotes.forEach((q) => set.add(q.route));
  state.sheets.forEach((s) => set.add(s.route));
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
});

/** 按线路核账:每条线路的报价数、已分摊报价数与运费对照 */
const routeLedger = computed(() =>
  routes.value.map((route) => {
    const quotes = state.quotes.filter((q) => q.route === route);
    const settled = quotes.filter((q) => currentSheetOf(state.sheets, q.id) !== null);
    const sum = (list: Quote[]) => list.reduce((s, q) => s + q.totalFreightCents, 0);
    return {
      route,
      quoteCount: quotes.length,
      settledCount: settled.length,
      freightCents: sum(quotes),
      settledCents: sum(settled),
      openCents: sum(quotes) - sum(settled),
    };
  })
);

function addQuote(input: {
  route: string;
  totalFreightYuan: number;
  consignees: { name: string; weightKg: number; volumeCbm: number }[];
  notes: string;
}) {
  const consignees: Consignee[] = input.consignees.map((c) => ({
    id: crypto.randomUUID(),
    name: c.name.trim(),
    weightKg: c.weightKg,
    volumeCbm: c.volumeCbm,
  }));
  state.quotes = [
    {
      id: crypto.randomUUID(),
      route: input.route.trim(),
      totalFreightCents: yuanToCents(input.totalFreightYuan),
      consignees,
      notes: input.notes.trim() || "暂无备注",
      createdAt: new Date().toISOString(),
    },
    ...state.quotes,
  ];
  persist();
}

/** 已有分摊单的报价不允许删除,保证旧单仍可查 */
function removeQuote(quoteId: string) {
  if (state.sheets.some((s) => s.quoteId === quoteId)) return;
  state.quotes = state.quotes.filter((q) => q.id !== quoteId);
  if (state.draft?.quoteId === quoteId) state.draft = null;
  persist();
}

/** 从报价发起试算 */
function startDraft(quoteId: string) {
  const quote = quoteOf(quoteId);
  if (!quote) return;
  state.draft = {
    quoteId,
    sourceSheetId: null,
    totalFreightCents: quote.totalFreightCents,
    lines: quote.consignees.map((c) => ({
      name: c.name,
      weightKg: c.weightKg,
      volumeCbm: c.volumeCbm,
    })),
    result: null,
    stale: true,
  };
}

/** 已确认的分摊单只能复制成新版本 */
function copySheetToDraft(sheetId: string) {
  const sheet = state.sheets.find((s) => s.id === sheetId);
  if (!sheet || sheet.status === "withdrawn") return;
  state.draft = {
    quoteId: sheet.quoteId,
    sourceSheetId: sheet.id,
    totalFreightCents: sheet.totalFreightCents,
    lines: sheet.lines.map((l) => ({
      name: l.name,
      weightKg: l.weightKg,
      volumeCbm: l.volumeCbm,
    })),
    result: null,
    stale: true,
  };
}

function mutateDraft(mutate: (draft: AllocationDraft) => void) {
  if (!state.draft) return;
  mutate(state.draft);
  // 任何明细改动都让旧结果作废:先重算,再确认
  state.draft.result = null;
  state.draft.stale = true;
}

function recalcDraft() {
  const draft = state.draft;
  if (!draft || draft.lines.length === 0) return;
  draft.result = buildAllocationLines(draft.lines, draft.totalFreightCents);
  draft.stale = false;
}

/** 确认分摊:同一报价只留一张当前分摊单 */
function confirmDraft() {
  const draft = state.draft;
  if (!draft || draft.stale || !draft.result) return;
  const quote = quoteOf(draft.quoteId);
  if (!quote) return;
  const sheet: AllocationSheet = {
    id: crypto.randomUUID(),
    quoteId: quote.id,
    route: quote.route,
    version: nextVersion(state.sheets, quote.id),
    status: "current",
    sentAt: null,
    withdrawnAt: null,
    sourceSheetId: draft.sourceSheetId,
    totalFreightCents: draft.totalFreightCents,
    totalChargeableKg: totalChargeableKg(draft.result),
    lines: draft.result,
    createdAt: new Date().toISOString(),
  };
  state.sheets = applyConfirm(state.sheets, sheet);
  state.draft = null;
  state.lastConfirmedSheetId = sheet.id;
  persist();
}

function sendSheet(sheetId: string) {
  state.sheets = applySend(state.sheets, sheetId, new Date().toISOString());
  persist();
}

/** 撤回未发出的版本,上一版重新成为当前结果 */
function withdrawSheet(sheetId: string) {
  state.sheets = applyWithdraw(state.sheets, sheetId, new Date().toISOString());
  persist();
}

export const store = {
  state,
  routes,
  routeLedger,
  quoteOf,
  sheetsOfQuote: (quoteId: string) => sheetsOfQuote(state.sheets, quoteId),
  currentSheetOf: (quoteId: string) => currentSheetOf(state.sheets, quoteId),
  nextVersion: (quoteId: string) => nextVersion(state.sheets, quoteId),
  addQuote,
  removeQuote,
  startDraft,
  copySheetToDraft,
  mutateDraft,
  recalcDraft,
  confirmDraft,
  sendSheet,
  withdrawSheet,
};
