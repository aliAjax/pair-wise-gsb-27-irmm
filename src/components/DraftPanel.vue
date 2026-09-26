<script setup lang="ts">
import { computed } from "vue";
import { store } from "../store";
import { formatCents, formatKg, formatPercent } from "../utils/format";

const { state } = store;

const draft = computed(() => state.draft);

const quote = computed(() => (draft.value ? store.quoteOf(draft.value.quoteId) : null));

const sourceSheet = computed(() => {
  const id = draft.value?.sourceSheetId;
  return id ? state.sheets.find((s) => s.id === id) ?? null : null;
});

const draftValid = computed(() => {
  const d = draft.value;
  if (!d) return false;
  return (
    d.totalFreightCents > 0 &&
    d.lines.length > 0 &&
    d.lines.every(
      (l) =>
        l.name.trim() !== "" &&
        Number.isFinite(l.weightKg) &&
        l.weightKg >= 0 &&
        Number.isFinite(l.volumeCbm) &&
        l.volumeCbm >= 0
    )
  );
});

const canConfirm = computed(() => {
  const d = draft.value;
  return !!d && draftValid.value && !d.stale && d.result !== null;
});

const resultTotalCents = computed(() => {
  const d = draft.value;
  if (!d?.result) return 0;
  return d.result.reduce((sum, l) => sum + l.amountCents, 0);
});

const resultTotalChargeable = computed(() => {
  const d = draft.value;
  if (!d?.result) return 0;
  return d.result.reduce((sum, l) => sum + l.chargeableKg, 0);
});

function touch() {
  store.mutateDraft(() => {});
}

function addLine() {
  store.mutateDraft((d) => d.lines.push({ name: "", weightKg: 0, volumeCbm: 0 }));
}

function removeLine(index: number) {
  store.mutateDraft((d) => {
    d.lines.splice(index, 1);
  });
}
</script>

<template>
  <section class="panel">
    <h2>分摊工作台</h2>

    <div v-if="!draft" class="empty">
      从报价列表点击「试算分摊」,或在下方分摊单上「复制新版本」。
    </div>

    <template v-else>
      <div class="draft-head">
        <div>
          <strong>{{ quote?.route }}</strong>
          <span class="draft-meta">
            总运费 ¥{{ formatCents(draft.totalFreightCents) }} ·
            {{ sourceSheet ? `复制自 v${sourceSheet.version},确认后生成 v${store.nextVersion(draft.quoteId)}` : `确认后生成 v${store.nextVersion(draft.quoteId)}` }}
          </span>
        </div>
        <button type="button" class="secondary small" @click="state.draft = null">收起</button>
      </div>

      <div class="line-editor">
        <div class="line-editor-head">
          <span>收货人明细(改重量/体积后需先重算)</span>
          <button type="button" class="secondary small" @click="addLine">+ 添加行</button>
        </div>
        <div v-for="(line, index) in draft.lines" :key="index" class="line-row">
          <input v-model="line.name" placeholder="收货人" @input="touch" />
          <input
            v-model.number="line.weightKg"
            type="number"
            min="0"
            step="0.01"
            placeholder="重量kg"
            @input="touch"
          />
          <input
            v-model.number="line.volumeCbm"
            type="number"
            min="0"
            step="0.01"
            placeholder="体积m³"
            @input="touch"
          />
          <button
            type="button"
            class="danger small"
            :disabled="draft.lines.length <= 1"
            @click="removeLine(index)"
          >
            删
          </button>
        </div>
      </div>

      <p v-if="!draftValid" class="form-error">请补全每个收货人的名称、重量和体积(不得为负)。</p>
      <p v-else-if="draft.stale" class="stale-hint">明细已修改,请先重算再确认。</p>

      <div class="actions">
        <button type="button" :disabled="!draftValid" @click="store.recalcDraft()">重算</button>
        <button type="button" :disabled="!canConfirm" @click="store.confirmDraft()">
          确认分摊(生成 v{{ store.nextVersion(draft.quoteId) }})
        </button>
      </div>

      <table v-if="draft.result && !draft.stale" class="alloc-table">
        <thead>
          <tr>
            <th>收货人</th>
            <th>实际重kg</th>
            <th>体积m³</th>
            <th>体积重kg</th>
            <th>计费重kg</th>
            <th>占比</th>
            <th>分摊金额</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in draft.result" :key="index">
            <td>
              {{ line.name }}
              <span v-if="line.takesRemainder" class="remainder-badge">尾差</span>
            </td>
            <td>{{ formatKg(line.weightKg) }}</td>
            <td>{{ formatKg(line.volumeCbm) }}</td>
            <td>{{ formatKg(line.volumetricKg) }}</td>
            <td>{{ formatKg(line.chargeableKg) }}</td>
            <td>{{ formatPercent(line.ratio) }}</td>
            <td class="money">¥{{ formatCents(line.amountCents) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>合计</td>
            <td colspan="3"></td>
            <td>{{ formatKg(resultTotalChargeable) }}</td>
            <td>100%</td>
            <td class="money">¥{{ formatCents(resultTotalCents) }}</td>
          </tr>
        </tfoot>
      </table>
    </template>
  </section>
</template>
