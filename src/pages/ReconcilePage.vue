<script setup lang="ts">
// 页面三：线路核账 —— 按线路汇总当前分摊单，差额应为 0；标出未确认与改后未确认
import { computed } from "vue";
import { formatCents, formatTime } from "../domain/format";
import { useAllocationStore } from "../stores/allocationStore";

const store = useAllocationStore();

const routes = computed(() => store.reconcileByRoute);

const totals = computed(() => ({
  quotes: routes.value.reduce((sum, route) => sum + route.quoteCount, 0),
  confirmed: routes.value.reduce((sum, route) => sum + route.confirmedCount, 0),
  sheetTotal: routes.value.reduce((sum, route) => sum + route.sheetTotalCents, 0),
  allocated: routes.value.reduce((sum, route) => sum + route.allocatedCents, 0),
  diff: routes.value.reduce((sum, route) => sum + route.diffCents, 0),
}));
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>按线路核账</h2>
      <span class="hint">数据保存在浏览器本地，重开页面可继续核账；差额 = 当前单运费 − 分摊合计，应为 ¥0.00</span>
    </div>

    <div v-if="routes.length === 0" class="empty">暂无报价</div>

    <div v-for="route in routes" :key="route.route" class="sheet-group">
      <div class="route-summary">
        <strong>{{ route.route }}</strong>
        <span>报价 {{ route.quoteCount }} 条</span>
        <span>已确认 {{ route.confirmedCount }} 条</span>
        <span>当前单运费 ¥{{ formatCents(route.sheetTotalCents) }}</span>
        <span>分摊合计 ¥{{ formatCents(route.allocatedCents) }}</span>
        <span :class="route.diffCents === 0 ? 'ok' : 'err'">差额 ¥{{ formatCents(route.diffCents) }}</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>登记时间</th>
              <th class="num">收货人</th>
              <th class="num">录入总运费</th>
              <th>当前版本</th>
              <th>状态</th>
              <th class="num">当前单运费</th>
              <th class="num">分摊合计</th>
              <th class="num">差额</th>
              <th>核账标记</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in route.rows" :key="row.quoteId">
              <td>{{ formatTime(row.createdAt) }}</td>
              <td class="num">{{ row.consigneeCount }}</td>
              <td class="num">¥{{ formatCents(row.recordedTotalCents) }}</td>
              <td>{{ row.version ? `v${row.version}` : "—" }}</td>
              <td>{{ row.statusLabel }}</td>
              <td class="num">{{ row.version ? `¥${formatCents(row.sheetTotalCents)}` : "—" }}</td>
              <td class="num">{{ row.version ? `¥${formatCents(row.allocatedCents)}` : "—" }}</td>
              <td class="num" :class="row.diffCents === 0 ? 'ok' : 'err'">
                {{ row.version ? `¥${formatCents(row.diffCents)}` : "—" }}
              </td>
              <td>
                <span class="badge" :class="row.flag === '已对平' ? 'current' : 'warn'">{{ row.flag }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="routes.length > 0" class="route-summary total-line">
      <strong>全部线路合计</strong>
      <span>报价 {{ totals.quotes }} 条</span>
      <span>已确认 {{ totals.confirmed }} 条</span>
      <span>当前单运费 ¥{{ formatCents(totals.sheetTotal) }}</span>
      <span>分摊合计 ¥{{ formatCents(totals.allocated) }}</span>
      <span :class="totals.diff === 0 ? 'ok' : 'err'">差额 ¥{{ formatCents(totals.diff) }}</span>
    </div>
  </section>
</template>
