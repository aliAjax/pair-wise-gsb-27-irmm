<script setup lang="ts">
// 页面二：分摊单 —— 版本留痕，当前单可发出/撤回，历史与已撤回单均可查明细
import { computed, ref } from "vue";
import AllocationTable from "../components/AllocationTable.vue";
import { formatCents, formatTime } from "../domain/format";
import type { AllocationSheet } from "../domain/types";
import { useAllocationStore } from "../stores/allocationStore";

const store = useAllocationStore();
const expandedId = ref<string | null>(null);

const groups = computed(() =>
  store.quotes
    .map((quote) => ({ quote, sheets: store.sheetsOf(quote.id) }))
    .filter((group) => group.sheets.length > 0)
);

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function isCurrent(sheet: AllocationSheet): boolean {
  return store.findQuote(sheet.quoteId)?.currentSheetId === sheet.id;
}

// 只有「当前 · 已确认（未发出）」的版本可发出、可撤回
function canOperate(sheet: AllocationSheet): boolean {
  return sheet.status === "confirmed" && isCurrent(sheet);
}

function withdraw(sheet: AllocationSheet) {
  if (window.confirm(`撤回 v${sheet.version} 后，上一版将重新成为当前结果。确定撤回？`)) {
    store.withdrawSheet(sheet.id);
  }
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>分摊单版本</h2>
      <span class="hint">确认后不可改，只能复制为新版本；历史与已撤回版本均可查明细</span>
    </div>

    <div v-if="groups.length === 0" class="empty">暂无分摊单，请先在「报价登记」页重算并确认</div>

    <div v-for="group in groups" :key="group.quote.id" class="sheet-group">
      <h3 class="group-title">
        {{ group.quote.route }}
        <span class="hint">报价登记于 {{ formatTime(group.quote.createdAt) }}</span>
      </h3>

      <article v-for="sheet in group.sheets" :key="sheet.id" class="record">
        <div class="record-head">
          <p class="record-title">
            v{{ sheet.version }} · ¥{{ formatCents(sheet.totalFreightCents) }} · {{ sheet.rows.length }} 家收货人
          </p>
          <span class="badge" :class="store.sheetBadge(sheet).tone">{{ store.sheetBadge(sheet).label }}</span>
        </div>
        <div class="details">
          <span>确认：{{ formatTime(sheet.createdAt) }}</span>
          <span v-if="sheet.sentAt">发出：{{ formatTime(sheet.sentAt) }}</span>
          <span v-if="sheet.withdrawnAt">撤回：{{ formatTime(sheet.withdrawnAt) }}</span>
          <span>分摊合计：¥{{ formatCents(sheet.allocatedCents) }}</span>
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="toggle(sheet.id)">
            {{ expandedId === sheet.id ? "收起明细" : "查看明细" }}
          </button>
          <button v-if="canOperate(sheet)" type="button" @click="store.sendSheet(sheet.id)">发出</button>
          <button v-if="canOperate(sheet)" type="button" class="danger" @click="withdraw(sheet)">撤回</button>
          <button
            v-if="sheet.status !== 'withdrawn'"
            type="button"
            class="secondary"
            @click="store.copySheetAsDraft(sheet.id)"
          >
            复制为新版本
          </button>
        </div>
        <AllocationTable
          v-if="expandedId === sheet.id"
          class="sheet-detail"
          :rows="sheet.rows"
          :total-cents="sheet.totalFreightCents"
        />
      </article>
    </div>
  </section>
</template>
