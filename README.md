# 物流整车费用分摊台

- 行业：物流
- 技术栈：Vue3、Vite、TypeScript、Pinia、Element Plus
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

整车报价只记总费用，多个收货人结算时由本台拆分：

- 一张报价登记线路、总运费和各收货人的实际重量、体积；
- 体积按 200kg/m³ 折算，计费重取实际重与折算重的较大值；
- 按计费重占比把总运费拆到分，尾差补给计费重最大的收货人；
- 改动重量/体积/运费后必须先「重算」才能确认；
- 已确认的分摊单不可改，只能复制成新版本，旧单留痕可查；
- 同一报价只保留一张当前分摊单，重复确认不会重复生成；
- 未发出的当前版本可撤回，撤回后上一版重新成为当前结果；
- 数据保存在浏览器 localStorage，重开页面仍可按线路核账。

## 目录结构

- `src/domain/`：资料模型（types）、分摊规则（allocation）、示例资料（seed）、格式化（format）
- `src/storage/`：localStorage 存取（repository）
- `src/stores/`：Pinia 状态与动作（allocationStore）
- `src/pages/`：报价登记、分摊单、线路核账三个页面
- `src/components/`：分摊明细表（AllocationTable，试算预览与单据快照共用）
