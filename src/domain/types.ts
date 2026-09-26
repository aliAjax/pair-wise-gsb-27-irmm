// 资料模型：报价、收货人、分摊单版本

export interface ConsigneeLine {
  id: string;
  name: string;
  weightKg: number; // 实际重量
  volumeM3: number; // 体积
}

export interface AllocationRow {
  consigneeId: string;
  name: string;
  weightKg: number;
  volumeM3: number;
  volumeWeightKg: number; // 体积折算重
  chargeableWeightKg: number; // 计费重
  ratio: number; // 计费重占比（0~1）
  amountCents: number; // 分摊金额（分）
  remainderCents: number; // 承担的尾差（分），非尾差位为 0
  isRemainderTarget: boolean; // 是否尾差承担者（计费重最大）
}

export interface Quote {
  id: string;
  route: string; // 运输线路
  totalFreightCents: number; // 总运费（分）
  consignees: ConsigneeLine[];
  note: string;
  createdAt: string;
  currentSheetId: string | null; // 当前生效的分摊单（同一报价只留一张）
  computedFingerprint: string | null; // 上次重算时的资料指纹
  preview: AllocationRow[] | null; // 上次重算结果
}

export type SheetStatus = "confirmed" | "sent" | "withdrawn";

export interface AllocationSheet {
  id: string;
  quoteId: string;
  version: number; // 同一报价内递增
  status: SheetStatus;
  route: string; // 快照：线路
  totalFreightCents: number; // 快照：总运费
  rows: AllocationRow[]; // 快照：分摊明细
  allocatedCents: number; // 分摊合计（应等于总运费）
  inputFingerprint: string; // 确认时的资料指纹，用于识别重复确认与改后未确认
  createdAt: string;
  sentAt: string | null;
  withdrawnAt: string | null;
}

export interface QuoteInput {
  route: string;
  totalFreightCents: number;
  consignees: ConsigneeLine[];
}
