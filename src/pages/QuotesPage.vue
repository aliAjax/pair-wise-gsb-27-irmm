<script setup lang="ts">
// 页面一：报价登记 —— 线路、总运费、收货人明细，重算试算后确认分摊
import { computed, ref } from "vue";
import AllocationTable from "../components/AllocationTable.vue";
import { chargeableWeightKg } from "../domain/allocation";
import { formatCents, formatKg, yuanToCents } from "../domain/format";
import type { Quote } from "../domain/types";
import { useAllocationStore } from "../stores/allocationStore";

const store = useAllocationStore();

const newRoute = ref("");
const newTotalYuan = ref("");
const newNote = ref("");

const quote = computed<Quote | null>(
  () => store.quotes.find((item) => item.id === store.selectedQuoteId) ?? null
);
const currentSheet = computed(() => (quote.value ? store.currentSheetOf(quote.value.id) : null));
const stale = computed(() => (quote.value ? store.isStale(quote.value) : false));

function createQuote() {
  const cents = yuanToCents(newTotalYuan.value);
  const result = store.addQuote({
    route: newRoute.value,
    totalFreightCents: cents ?? 0,
    note: newNote.value,
  });
  if (result.ok) {
    newRoute.value = "";
    newTotalYuan.value = "";
    newNote.value = "";
  }
}

function onTotalChange(target: Quote, event: Event) {
  const input = event.target as HTMLInputElement;
  const cents = yuanToCents(input.value);
  if (cents === null || cents <= 0) {
    input.value = (target.totalFreightCents / 100).toFixed(2);
    store.notice = { ok: false, message: "总运费需为大于 0 的金额" };
    return;
  }
  target.totalFreightCents = cents;
  input.value = (cents / 100).toFixed(2);
}

const norm = (value: unknown) => Math.max(0, Number(value) || 0);

function removeQuote() {
  if (!quote.value) return;
  if (window.confirm(`删除报价「${quote.value.route}」及其全部分摊单？`)) {
    store.removeQuote(quote.value.id);
  }
}

function quoteMeta(item: Quote): string {
  const current = store.currentSheetOf(item.id);
  const status = current ? `v${current.version} ${store.sheetBadge(current).label}` : "未确认";
  const count = item.consignees.filter((consignee) => consignee.name.trim()).length;
  return `¥${formatCents(item.totalFreightCents)} · ${count}家 · ${status}`;
}
</script>

<template>
  <section class="workspace">
    <div>
      <form class="panel" @submit.prevent="createQuote">
        <h2>新增报价</h2>
        <div class="form-grid">
          <label>
            运输线路
            <input v-model="newRoute" placeholder="如：上海-南京" required />
          </label>
          <label>
            总运费（元）
            <input v-model="newTotalYuan" type="number" min="0.01" step="0.01" placeholder="如：1260.00" required />
          </label>
          <label>
            备注
            <textarea v-model="newNote" placeholder="选填：客户、车型、装卸说明等" />
          </label>
          <button type="submit">登记报价</button>
        </div>
      </form>

      <div class="panel panel-gap">
        <h2>报价列表</h2>
        <div class="quote-list">
          <button
            v-for="item in store.quotes"
            :key="item.id"
            type="button"
            class="quote-item"
            :class="{ active: quote?.id === item.id }"
            @click="store.selectedQuoteId = item.id"
          >
            <span class="quote-route">{{ item.route }}</span>
            <span class="quote-meta">{{ quoteMeta(item) }}</span>
          </button>
          <div v-if="store.quotes.length === 0" class="empty">暂无报价</div>
        </div>
      </div>
    </div>

    <section v-if="quote" class="list-panel">
      <div class="toolbar">
        <h2>报价明细</h2>
        <button type="button" class="danger" @click="removeQuote">删除报价</button>
      </div>

      <div class="edit-grid">
        <label>
          运输线路
          <input v-model.trim="quote.route" />
        </label>
        <label>
          总运费（元）
          <input
            type="number"
            min="0.01"
            step="0.01"
            :value="(quote.totalFreightCents / 100).toFixed(2)"
            @change="onTotalChange(quote, $event)"
          />
        </label>
      </div>

      <h3 class="section-title">收货人明细（体积按 200kg/m³ 折算，计费重取实际重与折算重的较大值）</h3>
      <div class="consignee-head">
        <span>收货人</span>
        <span>实际重量 kg</span>
        <span>体积 m³</span>
        <span>计费重 kg</span>
        <span />
      </div>
      <div v-for="item in quote.consignees" :key="item.id" class="consignee-row">
        <input v-model.trim="item.name" placeholder="收货人名称" />
        <input
          v-model.number="item.weightKg"
          type="number"
          min="0"
          step="0.01"
          @change="item.weightKg = norm(item.weightKg)"
        />
        <input
          v-model.number="item.volumeM3"
          type="number"
          min="0"
          step="0.001"
          @change="item.volumeM3 = norm(item.volumeM3)"
        />
        <span class="cw">{{ formatKg(chargeableWeightKg(Number(item.weightKg) || 0, Number(item.volumeM3) || 0)) }}</span>
        <button type="button" class="danger" @click="store.removeConsignee(quote.id, item.id)">移除</button>
      </div>
      <button type="button" class="secondary" @click="store.addConsignee(quote.id)">+ 添加收货人</button>

      <div class="toolbar toolbar-gap">
        <h3 class="section-title section-title-flat">分摊试算</h3>
        <button type="button" @click="store.recomputeQuote(quote.id)">重算分摊</button>
      </div>
      <p v-if="stale" class="hint warn">资料已修改，请先重算；确认以最新试算结果为准。</p>
      <AllocationTable v-if="quote.preview" :rows="quote.preview" :total-cents="quote.totalFreightCents" />
      <p v-else class="hint">尚未试算，请完善资料后点击「重算分摊」。</p>

      <div class="toolbar toolbar-gap">
        <button type="button" :disabled="!store.canConfirm(quote)" @click="store.confirmQuote(quote.id)">
          确认分摊
        </button>
        <span class="hint">{{ store.confirmHint(quote) }}</span>
      </div>

      <p v-if="currentSheet" class="note">
        当前分摊单：v{{ currentSheet.version }} · {{ store.sheetBadge(currentSheet).label }} · 合计 ¥{{ formatCents(currentSheet.allocatedCents) }}
        <a class="link" @click="store.activePage = 'sheets'">前往分摊单 →</a>
      </p>
    </section>

    <section v-else class="list-panel">
      <div class="empty">请选择左侧报价，或先登记新报价</div>
    </section>
  </section>
</template>
