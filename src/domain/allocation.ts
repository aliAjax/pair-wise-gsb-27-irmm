/**
 * 分摊规则(纯函数,不依赖界面与存取):
 * 1. 体积按每立方米 200 公斤折算;
 * 2. 计费重 = max(实际重量, 体积折算重);
 * 3. 按计费重占比把总运费拆到分;
 * 4. 尾差全部补给计费重最大的收货人(并列取第一位)。
 */
import type { AllocationLine, DraftLine } from "../types";

/** 体积折算:每立方米 200 公斤 */
export const KG_PER_CBM = 200;

export function volumetricWeightKg(volumeCbm: number): number {
  return volumeCbm * KG_PER_CBM;
}

export function chargeableWeightKg(weightKg: number, volumeCbm: number): number {
  return Math.max(weightKg, volumetricWeightKg(volumeCbm));
}

/** 元(最多两位小数) → 分 */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/**
 * 把整数分按计费重占比拆开:
 * 每行先向下取整到分,剩下的尾差补给计费重最大的一行。
 * 计费重全为 0 时占比视为 0,整笔金额作为尾差落到第一行。
 */
export function splitCents(
  totalCents: number,
  chargeableWeights: number[]
): { amounts: number[]; remainderIndex: number } {
  const safeWeights = chargeableWeights.map((w) => Math.max(0, w));
  const totalWeight = safeWeights.reduce((sum, w) => sum + w, 0);
  const amounts = safeWeights.map((w) =>
    totalWeight > 0 ? Math.floor((totalCents * w) / totalWeight) : 0
  );
  const allocated = amounts.reduce((sum, a) => sum + a, 0);
  let remainderIndex = 0;
  safeWeights.forEach((w, i) => {
    if (w > safeWeights[remainderIndex]) remainderIndex = i;
  });
  if (amounts.length > 0) {
    amounts[remainderIndex] += totalCents - allocated;
  }
  return { amounts, remainderIndex };
}

/** 由草稿明细算出每一行的计费重、占比和分摊金额 */
export function buildAllocationLines(
  lines: DraftLine[],
  totalCents: number
): AllocationLine[] {
  const chargeables = lines.map((l) => chargeableWeightKg(l.weightKg, l.volumeCbm));
  const totalChargeable = chargeables.reduce((sum, w) => sum + w, 0);
  const { amounts, remainderIndex } = splitCents(totalCents, chargeables);
  return lines.map((l, i) => ({
    name: l.name,
    weightKg: l.weightKg,
    volumeCbm: l.volumeCbm,
    volumetricKg: volumetricWeightKg(l.volumeCbm),
    chargeableKg: chargeables[i],
    ratio: totalChargeable > 0 ? chargeables[i] / totalChargeable : 0,
    amountCents: amounts[i],
    takesRemainder: i === remainderIndex,
  }));
}

export function totalChargeableKg(lines: AllocationLine[]): number {
  return lines.reduce((sum, l) => sum + l.chargeableKg, 0);
}
