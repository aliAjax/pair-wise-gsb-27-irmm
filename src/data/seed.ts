/** 首次打开时的演示资料;分摊结果走同一套分摊规则生成,保证账平 */
import { buildAllocationLines, totalChargeableKg, yuanToCents } from "../domain/allocation";
import type { AllocationSheet, Quote } from "../types";

export interface Book {
  quotes: Quote[];
  sheets: AllocationSheet[];
}

export function buildSeedBook(): Book {
  const now = Date.now();
  const day = 86400000;
  const quotes: Quote[] = [
    {
      id: "quote-seed-1",
      route: "上海-南京",
      totalFreightCents: yuanToCents(3600),
      notes: "9.6米整车,三个收货人拼一车",
      createdAt: new Date(now - 2 * day).toISOString(),
      consignees: [
        { id: "c-seed-1", name: "海沃商贸", weightKg: 180, volumeCbm: 0.35 },
        { id: "c-seed-2", name: "云仓食品", weightKg: 95, volumeCbm: 0.6 },
        { id: "c-seed-3", name: "顺达电子", weightKg: 120, volumeCbm: 0.2 },
      ],
    },
    {
      id: "quote-seed-2",
      route: "杭州-合肥",
      totalFreightCents: yuanToCents(2400),
      notes: "冷链回程车",
      createdAt: new Date(now - day).toISOString(),
      consignees: [
        { id: "c-seed-4", name: "云仓食品", weightKg: 95, volumeCbm: 0.5 },
        { id: "c-seed-5", name: "徽味食品", weightKg: 210, volumeCbm: 0.3 },
      ],
    },
  ];
  const first = quotes[0];
  const lines = buildAllocationLines(first.consignees, first.totalFreightCents);
  const sheets: AllocationSheet[] = [
    {
      id: "sheet-seed-1",
      quoteId: first.id,
      route: first.route,
      version: 1,
      status: "current",
      sentAt: null,
      withdrawnAt: null,
      sourceSheetId: null,
      totalFreightCents: first.totalFreightCents,
      totalChargeableKg: totalChargeableKg(lines),
      lines,
      createdAt: new Date(now - day).toISOString(),
    },
  ];
  return { quotes, sheets };
}
