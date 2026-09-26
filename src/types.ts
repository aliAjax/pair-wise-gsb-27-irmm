/**
 * 资料模型:报价、收货人、分摊单、试算草稿。
 * 金额一律以"分"存储,展示时再格式化为元。
 */

/** 报价里的收货人登记资料 */
export interface Consignee {
  id: string;
  name: string;
  /** 实际重量 kg */
  weightKg: number;
  /** 体积 m³ */
  volumeCbm: number;
}

/** 一张整车报价:线路 + 总运费 + 各收货人明细 */
export interface Quote {
  id: string;
  /** 运输线路,如 上海-南京 */
  route: string;
  /** 总运费(分) */
  totalFreightCents: number;
  consignees: Consignee[];
  notes: string;
  createdAt: string;
}

/** 分摊单里某一收货人的分摊结果(确认时的快照) */
export interface AllocationLine {
  name: string;
  weightKg: number;
  volumeCbm: number;
  /** 体积折算重 kg = 体积 × 200 */
  volumetricKg: number;
  /** 计费重 kg = max(实际重量, 体积折算重) */
  chargeableKg: number;
  /** 计费重占比 0~1 */
  ratio: number;
  /** 分摊金额(分) */
  amountCents: number;
  /** 是否承担尾差 */
  takesRemainder: boolean;
}

/**
 * 分摊单状态:
 * - current   当前生效(同一报价只留一张)
 * - history   已被新版本替代,仍可查询
 * - withdrawn 未发出被撤回,仅留档
 */
export type SheetStatus = "current" | "history" | "withdrawn";

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  current: "当前",
  history: "历史",
  withdrawn: "已撤回",
};

/** 分摊单:一张报价的一个确认版本 */
export interface AllocationSheet {
  id: string;
  quoteId: string;
  /** 冗余线路,便于按线路核账 */
  route: string;
  /** 版本号,同一报价内递增 */
  version: number;
  status: SheetStatus;
  /** 发出时间;已发出的版本不可撤回 */
  sentAt: string | null;
  withdrawnAt: string | null;
  /** 复制自哪一张分摊单 */
  sourceSheetId: string | null;
  totalFreightCents: number;
  totalChargeableKg: number;
  lines: AllocationLine[];
  createdAt: string;
}

/** 试算草稿里的一行(可编辑) */
export interface DraftLine {
  name: string;
  weightKg: number;
  volumeCbm: number;
}

/** 分摊工作台的草稿:改重量后必须重算才能确认 */
export interface AllocationDraft {
  quoteId: string;
  sourceSheetId: string | null;
  totalFreightCents: number;
  lines: DraftLine[];
  /** 最近一次重算的结果;改动明细后作废 */
  result: AllocationLine[] | null;
  /** 明细已修改、需要先重算 */
  stale: boolean;
}
