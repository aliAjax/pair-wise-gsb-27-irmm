<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { store } from "../store";

const routes = store.routes;

interface FormLine {
  name: string;
  weightKg: number | null;
  volumeCbm: number | null;
}

const blankLine = (): FormLine => ({ name: "", weightKg: null, volumeCbm: null });

const form = reactive({
  route: "",
  totalFreightYuan: null as number | null,
  notes: "",
  lines: [blankLine()] as FormLine[],
});

const error = ref("");

const canSubmit = computed(
  () =>
    form.route.trim() !== "" &&
    form.totalFreightYuan !== null &&
    form.totalFreightYuan > 0 &&
    form.lines.length > 0 &&
    form.lines.every(
      (l) =>
        l.name.trim() !== "" &&
        l.weightKg !== null &&
        l.weightKg >= 0 &&
        l.volumeCbm !== null &&
        l.volumeCbm >= 0
    )
);

function addLine() {
  form.lines.push(blankLine());
}

function removeLine(index: number) {
  form.lines.splice(index, 1);
}

function submit() {
  if (!canSubmit.value) {
    error.value = "请补全线路、总运费和每个收货人的名称、重量、体积";
    return;
  }
  store.addQuote({
    route: form.route,
    totalFreightYuan: form.totalFreightYuan as number,
    notes: form.notes,
    consignees: form.lines.map((l) => ({
      name: l.name,
      weightKg: l.weightKg as number,
      volumeCbm: l.volumeCbm as number,
    })),
  });
  form.route = "";
  form.totalFreightYuan = null;
  form.notes = "";
  form.lines = [blankLine()];
  error.value = "";
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>报价登记</h2>
    <div class="form-grid">
      <label>
        运输线路
        <input v-model="form.route" list="route-options" placeholder="如 上海-南京" required />
        <datalist id="route-options">
          <option v-for="route in routes" :key="route" :value="route" />
        </datalist>
      </label>
      <label>
        总运费(元)
        <input
          v-model.number="form.totalFreightYuan"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="整车总费用"
          required
        />
      </label>

      <div class="line-editor">
        <div class="line-editor-head">
          <span>收货人明细(实际重量 / 体积)</span>
          <button type="button" class="secondary small" @click="addLine">+ 添加收货人</button>
        </div>
        <div v-for="(line, index) in form.lines" :key="index" class="line-row">
          <input v-model="line.name" placeholder="收货人" required />
          <input
            v-model.number="line.weightKg"
            type="number"
            min="0"
            step="0.01"
            placeholder="重量kg"
            required
          />
          <input
            v-model.number="line.volumeCbm"
            type="number"
            min="0"
            step="0.01"
            placeholder="体积m³"
            required
          />
          <button
            type="button"
            class="danger small"
            :disabled="form.lines.length <= 1"
            @click="removeLine(index)"
          >
            删
          </button>
        </div>
      </div>

      <label>
        备注
        <textarea v-model="form.notes" placeholder="车型、温区、装卸要求等" />
      </label>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" :disabled="!canSubmit">保存报价</button>
    </div>
  </form>
</template>
