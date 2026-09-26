<script setup lang="ts">
import { computed } from "vue";
import DraftPanel from "./components/DraftPanel.vue";
import QuoteForm from "./components/QuoteForm.vue";
import QuoteList from "./components/QuoteList.vue";
import SheetBoard from "./components/SheetBoard.vue";
import { store } from "./store";
import { formatCents } from "./utils/format";

const { state } = store;

const project = {
  industry: "物流",
  title: "整车费用分摊台",
  subtitle:
    "登记线路与总运费,按收货人计费重(实际重量与体积折算 200kg/m³ 取大)占比拆分,金额精确到分,尾差归计费重最大者。",
  stack: ["Vue3", "Vite", "TypeScript", "Pinia", "Element Plus"],
} as const;

const metrics = computed(() => [
  { label: "报价数", value: state.quotes.length },
  {
    label: "当前分摊单",
    value: state.sheets.filter((s) => s.status === "current").length,
  },
  { label: "覆盖线路", value: store.routes.value.length },
  {
    label: "登记运费总额",
    value: `¥${formatCents(state.quotes.reduce((sum, q) => sum + q.totalFreightCents, 0))}`,
  },
]);
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ project.industry }}行业前端最小闭环</p>
          <h1>{{ project.title }}</h1>
          <p class="subtitle">{{ project.subtitle }}</p>
        </div>
        <div class="stack">
          <span v-for="item in project.stack" :key="item" class="tag">{{ item }}</span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <section class="workspace">
        <div class="side">
          <QuoteForm />
          <QuoteList />
        </div>
        <div class="main-col">
          <DraftPanel />
          <SheetBoard />
        </div>
      </section>
    </div>
  </main>
</template>
