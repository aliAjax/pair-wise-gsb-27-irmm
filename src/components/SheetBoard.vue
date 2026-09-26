<script setup lang="ts">
import { computed } from "vue";
import { canWithdraw } from "../domain/sheetBook";
import { store } from "../store";
import { SHEET_STATUS_LABELS, type AllocationSheet } from "../types";
import { formatCents, formatKg, formatPercent, formatTime } from "../utils/format";

const { state } = store;
const routes = store.routes;
const routeLedger = store.routeLedger;

const ledgerRows = computed(() =>
  state.routeFilter === "全部线路"
    ? routeLedger.value
    : routeLedger.value.filter((row) => row.route === state.routeFilter)
);

/** 有分摊单的报价,按线路筛选后分组展示 */
const groups = computed(() =>
  state.quotes
    .map((quote) => ({
      quote,
      sheets: store.sheetsOfQuote(quote.id),
    }))
    .filter((g) => g.sheets.length > 0)
    .filter((g) => state.routeFilter === "全部线路" || g.quote.route === state.routeFilter)
    .sort((a, b) => a.quote.route.localeCompare(b.quote.route, "zh-CN"))
);

function currentOf(group: { sheets: AllocationSheet[] }): AllocationSheet | null {
  return group.sheets.find((s) => s.status === "current") ?? null;
}

function archivedOf(group: { sheets: AllocationSheet[] }): AllocationSheet[] {
  return group.sheets.filter((s) => s.status !== "current").sort((a, b) => b.version - a.version);
}

function lineSum(sheet: AllocationSheet): number {
  return sheet.lines.reduce((sum, l) => sum + l.amountCents, 0);
}
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>分摊单与线路核账</h2>
      <select v-model="state.routeFilter">
        <option>全部线路</option>
        <option v-for="route in routes" :key="route">{{ route }}</option>
      </select>
    </div>

    <table class="alloc-table ledger">
      <thead>
        <tr>
          <th>线路</th>
          <th>报价数</th>
          <th>已分摊</th>
          <th>登记运费</th>
          <th>已分摊运费</th>
          <th>待分摊</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in ledgerRows" :key="row.route">
          <td>{{ row.route }}</td>
          <td>{{ row.quoteCount }}</td>
          <td>{{ row.settledCount }}</td>
          <td class="money">¥{{ formatCents(row.freightCents) }}</td>
          <td class="money">¥{{ formatCents(row.settledCents) }}</td>
          <td class="money" :class="{ 'open-cents': row.openCents > 0 }">
            ¥{{ formatCents(row.openCents) }}
          </td>
        </tr>
        <tr v-if="ledgerRows.length === 0">
          <td colspan="6" class="empty">暂无线路数据</td>
        </tr>
      </tbody>
    </table>

    <div v-for="group in groups" :key="group.quote.id" class="sheet-group">
      <h3>{{ group.quote.route }} <span class="group-meta">报价总运费 ¥{{ formatCents(group.quote.totalFreightCents) }}</span></h3>

      <article
        v-if="currentOf(group)"
        class="sheet-card"
        :class="{ highlighted: currentOf(group)!.id === state.lastConfirmedSheetId }"
      >
        <div class="record-head">
          <p class="record-title">
            v{{ currentOf(group)!.version }}
            <span class="status">{{ SHEET_STATUS_LABELS[currentOf(group)!.status] }}</span>
            <span v-if="currentOf(group)!.sentAt" class="status sent">已发出</span>
          </p>
          <span class="sheet-time">{{ formatTime(currentOf(group)!.createdAt) }}</span>
        </div>
        <table class="alloc-table">
          <thead>
            <tr>
              <th>收货人</th>
              <th>计费重kg</th>
              <th>占比</th>
              <th>分摊金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in currentOf(group)!.lines" :key="index">
              <td>
                {{ line.name }}
                <span v-if="line.takesRemainder" class="remainder-badge">尾差</span>
              </td>
              <td>{{ formatKg(line.chargeableKg) }}</td>
              <td>{{ formatPercent(line.ratio) }}</td>
              <td class="money">¥{{ formatCents(line.amountCents) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>合计</td>
              <td>{{ formatKg(currentOf(group)!.totalChargeableKg) }}</td>
              <td></td>
              <td class="money">¥{{ formatCents(lineSum(currentOf(group)!)) }}</td>
            </tr>
          </tfoot>
        </table>
        <div class="actions">
          <button
            v-if="!currentOf(group)!.sentAt"
            type="button"
            @click="store.sendSheet(currentOf(group)!.id)"
          >
            标记已发出
          </button>
          <button
            v-if="canWithdraw(currentOf(group)!)"
            type="button"
            class="danger"
            @click="store.withdrawSheet(currentOf(group)!.id)"
          >
            撤回
          </button>
          <button
            type="button"
            class="secondary"
            @click="store.copySheetToDraft(currentOf(group)!.id)"
          >
            复制新版本
          </button>
        </div>
      </article>
      <p v-else class="empty">当前无生效分摊单(全部已撤回),可从报价重新试算。</p>

      <details v-if="archivedOf(group).length > 0" class="history">
        <summary>历史与撤回版本({{ archivedOf(group).length }})</summary>
        <article v-for="sheet in archivedOf(group)" :key="sheet.id" class="sheet-card mini">
          <div class="record-head">
            <p class="record-title">
              v{{ sheet.version }}
              <span class="status" :class="sheet.status">{{ SHEET_STATUS_LABELS[sheet.status] }}</span>
              <span v-if="sheet.sentAt" class="status sent">已发出</span>
            </p>
            <span class="sheet-time">{{ formatTime(sheet.createdAt) }}</span>
          </div>
          <table class="alloc-table">
            <tbody>
              <tr v-for="(line, index) in sheet.lines" :key="index">
                <td>{{ line.name }}</td>
                <td>{{ formatKg(line.chargeableKg) }} kg</td>
                <td>{{ formatPercent(line.ratio) }}</td>
                <td class="money">¥{{ formatCents(line.amountCents) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>合计</td>
                <td colspan="2"></td>
                <td class="money">¥{{ formatCents(lineSum(sheet)) }}</td>
              </tr>
            </tfoot>
          </table>
          <div class="actions">
            <button
              v-if="sheet.status !== 'withdrawn'"
              type="button"
              class="secondary small"
              @click="store.copySheetToDraft(sheet.id)"
            >
              复制新版本
            </button>
          </div>
        </article>
      </details>
    </div>

    <div v-if="groups.length === 0" class="empty">该线路下暂无分摊单</div>
  </section>
</template>
