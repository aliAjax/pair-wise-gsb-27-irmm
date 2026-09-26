// 分摊规则：体积折算、计费重、按占比拆分到分、尾差归最大计费重

import type { AllocationRow, QuoteInput } from "./types";

export const VOLUME_KG_PER_M3 = 200; // 体积折算：每立方米 200 公斤

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function volumeWeightKg(volumeM3: number): number {
  return round2(volumeM3 * VOLUME_KG_PER_M3);
}

export function chargeableWeightKg(weightKg: number, volumeM3: number): number {
  return Math.max(weightKg, volumeWeightKg(volumeM3));
}

function normMeasure(value: number): number {
  return Number(value) || 0;
}

// 资料指纹：用于判断「改后需重算」与「重复确认只留一张」
export function fingerprintOf(input: QuoteInput): string {
  return JSON.stringify({
    route: input.route.trim(),
    total: input.totalFreightCents,
    rows: input.consignees.map((item) => [
      item.name.trim(),
      normMeasure(item.weightKg),
      normMeasure(item.volumeM3),
    ]),
  });
}

export type ComputeResult =
  | { ok: true; rows: AllocationRow[]; allocatedCents: number; totalChargeableKg: number }
  | { ok: false; error: string };

export function computeAllocation(input: QuoteInput): ComputeResult {
  if (!input.route.trim()) return { ok: false, error: "请填写运输线路" };
  if (!Number.isFinite(input.totalFreightCents) || input.totalFreightCents <= 0) {
    return { ok: false, error: "总运费必须大于 0" };
  }
  const hasBlankName = input.consignees.some(
    (item) => !item.name.trim() && (normMeasure(item.weightKg) > 0 || normMeasure(item.volumeM3) > 0)
  );
  if (hasBlankName) return { ok: false, error: "有收货人填了重量/体积但未填名称" };

  const consignees = input.consignees
    .filter((item) => item.name.trim())
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      weightKg: normMeasure(item.weightKg),
      volumeM3: normMeasure(item.volumeM3),
    }));
  if (consignees.length === 0) return { ok: false, error: "请至少填写一名收货人" };
  const invalid = consignees.find((item) => item.weightKg < 0 || item.volumeM3 < 0);
  if (invalid) return { ok: false, error: `收货人「${invalid.name}」的重量/体积不能为负` };

  const weights = consignees.map((item) => chargeableWeightKg(item.weightKg, item.volumeM3));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return { ok: false, error: "计费重合计为 0，请填写重量或体积" };

  const { shares, remainderIndex, remainderCents } = splitCentsByWeight(input.totalFreightCents, weights);
  const rows: AllocationRow[] = consignees.map((item, index) => ({
    consigneeId: item.id,
    name: item.name,
    weightKg: item.weightKg,
    volumeM3: item.volumeM3,
    volumeWeightKg: volumeWeightKg(item.volumeM3),
    chargeableWeightKg: weights[index],
    ratio: weights[index] / totalWeight,
    amountCents: shares[index],
    remainderCents: index === remainderIndex ? remainderCents : 0,
    isRemainderTarget: index === remainderIndex,
  }));
  return {
    ok: true,
    rows,
    allocatedCents: shares.reduce((sum, share) => sum + share, 0),
    totalChargeableKg: totalWeight,
  };
}

// 金额拆到分：各家向下取整，剩余尾差补给计费重最大的收货人（并列取第一家）
export function splitCentsByWeight(
  totalCents: number,
  weights: number[]
): { shares: number[]; remainderIndex: number; remainderCents: number } {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map((weight) => Math.floor((totalCents * weight) / totalWeight));
  const remainderCents = totalCents - shares.reduce((sum, share) => sum + share, 0);
  let remainderIndex = 0;
  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index] > weights[remainderIndex]) remainderIndex = index;
  }
  shares[remainderIndex] += remainderCents;
  return { shares, remainderIndex, remainderCents };
}
