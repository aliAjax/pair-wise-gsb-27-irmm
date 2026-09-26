<script setup lang="ts">
import { computed } from "vue";
import { formatCents } from "./domain/format";
import QuotesPage from "./pages/QuotesPage.vue";
import ReconcilePage from "./pages/ReconcilePage.vue";
import SheetsPage from "./pages/SheetsPage.vue";
import { useAllocationStore } from "./stores/allocationStore";

const store = useAllocationStore();

const pages = [
  { key: "quotes", label: "报价登记" },
  { key: "sheets", label: "分摊单" },
  { key: "reconcile", label: "线路核账" },
] as const;

const metrics = computed(() => {
  const currents = store.quotes
    .map((quote) => store.currentSheetOf(quote.id))
    .filter((sheet): sheet is NonNullable<typeof sheet> => Boolean(sheet));
  const totalCents = currents.reduce((sum, sheet) => sum + sheet.totalFreightCents, 0);
  return [
    { label: "报价数", value: String(store.quotes.length) },
    { label: "当前分摊单", value: String(currents.length) },
    { label: "覆盖线路", value: String(new Set(store.quotes.map((quote) => quote.route)).size) },
    { label: "当前分摊总额", value: `¥${formatCents(totalCents)}` },
  ];
});
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流行业前端最小闭环</p>
          <h1>整车费用分摊台</h1>
          <p class="subtitle">
            报价只记总运费，结算时按各收货人计费重（体积 200kg/m³ 折算）占比拆到分，尾差归计费重最大者；
            确认留版本、可撤回、可复制新单，重开页面仍可按线路核账。
          </p>
        </div>
        <div class="stack">
          <span v-for="item in ['Vue3', 'Vite', 'TypeScript', 'Pinia', 'Element Plus']" :key="item" class="tag">
            {{ item }}
          </span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <p
        v-if="store.notice"
        class="notice"
        :class="store.notice.ok ? 'ok' : 'err'"
        @click="store.notice = null"
      >
        {{ store.notice.message }}（点击关闭）
      </p>

      <nav class="tabs">
        <button
          v-for="page in pages"
          :key="page.key"
          type="button"
          class="tab"
          :class="{ active: store.activePage === page.key }"
          @click="store.activePage = page.key"
        >
          {{ page.label }}
        </button>
      </nav>

      <QuotesPage v-if="store.activePage === 'quotes'" />
      <SheetsPage v-else-if="store.activePage === 'sheets'" />
      <ReconcilePage v-else />
    </div>
  </main>
</template>
