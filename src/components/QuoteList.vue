<script setup lang="ts">
import { store } from "../store";
import { formatCents, formatKg } from "../utils/format";
import { chargeableWeightKg } from "../domain/allocation";

const { state } = store;

function quoteChargeable(quoteId: string): number {
  const quote = store.quoteOf(quoteId);
  if (!quote) return 0;
  return quote.consignees.reduce(
    (sum, c) => sum + chargeableWeightKg(c.weightKg, c.volumeCbm),
    0
  );
}

function currentLabel(quoteId: string): string {
  const sheet = store.currentSheetOf(quoteId);
  if (!sheet) return "未分摊";
  return sheet.sentAt ? `v${sheet.version} · 已发出` : `v${sheet.version} · 当前`;
}

function hasSheets(quoteId: string): boolean {
  return store.sheetsOfQuote(quoteId).length > 0;
}
</script>

<template>
  <section class="panel">
    <h2>报价列表</h2>
    <div class="record-grid">
      <div v-if="state.quotes.length === 0" class="empty">暂无报价,请先登记</div>
      <article v-for="quote in state.quotes" :key="quote.id" class="record">
        <div class="record-head">
          <p class="record-title">{{ quote.route }}</p>
          <span class="status">{{ currentLabel(quote.id) }}</span>
        </div>
        <div class="details">
          <span>总运费: ¥{{ formatCents(quote.totalFreightCents) }}</span>
          <span>收货人: {{ quote.consignees.length }} 家</span>
          <span>合计计费重: {{ formatKg(quoteChargeable(quote.id)) }} kg</span>
        </div>
        <p class="note">{{ quote.notes }}</p>
        <div class="actions">
          <button type="button" @click="store.startDraft(quote.id)">试算分摊</button>
          <button
            type="button"
            class="danger"
            :disabled="hasSheets(quote.id)"
            :title="hasSheets(quote.id) ? '已有分摊单,为保留账目不可删除' : ''"
            @click="store.removeQuote(quote.id)"
          >
            删除
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
