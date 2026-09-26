// 示例资料：首次打开（或数据损坏）时载入，分摊单由规则实时算出，保证账平

import { computeAllocation, fingerprintOf } from "./allocation";
import type { AllocationSheet, ConsigneeLine, Quote, QuoteInput } from "./types";

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `seed-${prefix}-${sequence}`;
}

function consignee(name: string, weightKg: number, volumeM3: number): ConsigneeLine {
  return { id: nextId("c"), name, weightKg, volumeM3 };
}

function buildSheet(
  quoteId: string,
  version: number,
  input: QuoteInput,
  status: AllocationSheet["status"],
  createdAt: string
): AllocationSheet {
  const result = computeAllocation(input);
  if (!result.ok) throw new Error(`种子资料无法试算：${result.error}`);
  return {
    id: nextId("s"),
    quoteId,
    version,
    status,
    route: input.route,
    totalFreightCents: input.totalFreightCents,
    rows: result.rows,
    allocatedCents: result.allocatedCents,
    inputFingerprint: fingerprintOf(input),
    createdAt,
    sentAt: status === "sent" ? createdAt : null,
    withdrawnAt: null,
  };
}

export function buildSeedState(): { quotes: Quote[]; sheets: AllocationSheet[] } {
  const day = 86400000;
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

  // 报价一：上海-南京。v1 已发出（历史），v2 加了一家收货人并确认，为当前分摊单
  const quoteAId = nextId("q");
  const inputA1: QuoteInput = {
    route: "上海-南京",
    totalFreightCents: 120000,
    consignees: [consignee("海沃商贸", 180, 0.4), consignee("云仓食品", 95, 0.9)],
  };
  const inputA2: QuoteInput = {
    route: "上海-南京",
    totalFreightCents: 126000,
    consignees: [
      consignee("海沃商贸", 180, 0.4),
      consignee("云仓食品", 95, 0.9),
      consignee("顺达五金", 260, 0.2),
    ],
  };
  const sheetA1 = buildSheet(quoteAId, 1, inputA1, "sent", iso(6));
  const sheetA2 = buildSheet(quoteAId, 2, inputA2, "confirmed", iso(2));
  const previewA = computeAllocation(inputA2);
  if (!previewA.ok) throw new Error("种子资料无法试算");
  const quoteA: Quote = {
    id: quoteAId,
    route: inputA2.route,
    totalFreightCents: inputA2.totalFreightCents,
    consignees: inputA2.consignees,
    note: "海沃月结；v2 新增顺达五金，尾差归计费重最大者",
    createdAt: iso(8),
    currentSheetId: sheetA2.id,
    computedFingerprint: fingerprintOf(inputA2),
    preview: previewA.rows,
  };

  // 报价二：杭州-合肥。只登记，尚未重算确认
  const quoteB: Quote = {
    id: nextId("q"),
    route: "杭州-合肥",
    totalFreightCents: 86000,
    consignees: [consignee("云仓食品", 120, 1.1), consignee("明轩电子", 45, 0.6)],
    note: "冷链回程车，待客户确认重量后重算",
    createdAt: iso(1),
    currentSheetId: null,
    computedFingerprint: null,
    preview: null,
  };

  return { quotes: [quoteA, quoteB], sheets: [sheetA1, sheetA2] };
}
