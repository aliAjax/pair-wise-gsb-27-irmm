<script setup lang="ts">
// 分摊明细表：试算预览与分摊单快照共用
import { computed } from "vue";
import { formatCents, formatKg, formatPercent } from "../domain/format";
import type { AllocationRow } from "../domain/types";

const props = defineProps<{ rows: AllocationRow[]; totalCents: number }>();

const totalChargeable = computed(() =>
  props.rows.reduce((sum, row) => sum + row.chargeableWeightKg, 0)
);
const allocated = computed(() => props.rows.reduce((sum, row) => sum + row.amountCents, 0));
</script>

<template>
  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr>
          <th>收货人</th>
          <th class="num">实际重量 kg</th>
          <th class="num">体积 m³</th>
          <th class="num">折算重 kg</th>
          <th class="num">计费重 kg</th>
          <th class="num">占比</th>
          <th class="num">分摊金额</th>
          <th>尾差</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.consigneeId">
          <td>{{ row.name }}</td>
          <td class="num">{{ formatKg(row.weightKg) }}</td>
          <td class="num">{{ row.volumeM3 }}</td>
          <td class="num">{{ formatKg(row.volumeWeightKg) }}</td>
          <td class="num">{{ formatKg(row.chargeableWeightKg) }}</td>
          <td class="num">{{ formatPercent(row.ratio) }}</td>
          <td class="num">¥{{ formatCents(row.amountCents) }}</td>
          <td>
            <span v-if="row.remainderCents > 0" class="badge warn">
              含尾差 ¥{{ formatCents(row.remainderCents) }}
            </span>
            <span v-else>—</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td>合计</td>
          <td class="num">—</td>
          <td class="num">—</td>
          <td class="num">—</td>
          <td class="num">{{ formatKg(totalChargeable) }}</td>
          <td class="num">100%</td>
          <td class="num">¥{{ formatCents(allocated) }}</td>
          <td>总运费 ¥{{ formatCents(totalCents) }}，尾差归计费重最大者</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
