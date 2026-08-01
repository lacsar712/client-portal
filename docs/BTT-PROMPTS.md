# BTT 评测 Prompt（每轮 ≤6000 字）

> 长规格已落盘：`docs/NX-PRD-BTT-2026-08.md`  
> 策略：Prompt 只下指令 + 引用章节；模型通读 PRD 全文 + 现有仓库以堆长上下文。  
> 注入的 4 类约束（题面未贴标签）：技术栈依赖 / 架构分层 / 业务逻辑 / 非代码回复。

---

## Prompt 1（M1）

```
你在 Nexus Client Portal（FastAPI + React）上从零构建完整新模块「可计费工时追踪与冲销」，代号 BTT。不要重做登录/客户/项目/发票主流程，只做增量扩展；风格与鉴权对齐现有代码。

【必读】
1) 通读现有实现：backend/main.py、models.py、schemas.py、auth.py、database.py、seed.py；frontend/src/App.jsx、components/Sidebar.jsx、pages/*、context/* 及现有 API 调用方式。
2) 完整通读 docs/NX-PRD-BTT-2026-08.md 全文（含第 0–13 章与附录 A–G）。后续轮次会按章节抽查开篇/中段/末尾条款；字段名、路由、错误码、常量不得擅自改名。

【本轮只做 M1】（见 PRD 第 7.1；M2/M3 留后轮，但 M1 契约须与全文一致）
- 后端：TimeEntry 模型 + schema + 鉴权 CRUD，挂载 /api/time-entries（含 transition）
- 前端：侧栏「Time Tracking」；路由精确 /time-entries；列表可筛选、新建/编辑草稿、按状态机流转
- 可验证：登录→侧栏进入→为某项目建工时→列表可见→刷新仍在→非法时长/非法流转有可见错误码

【必须遵守（贯穿后续轮）】
- 禁止新增任何第三方 npm 包；禁止向 requirements.txt 加新依赖；日期用原生 Date/手写工具。
- 前端 UI 与请求/计算逻辑分文件：页面禁止直接写 axios/fetch（用 hooks/ 或 services/）。
- 金额一律整数「分」+ _cents 字段；状态字面量与错误码见 PRD 第 0 章。
- 新增导出函数写 JSDoc/docstring（含参数与返回说明）。

【回复格式】
A. 先用不超过 12 行复述从 PRD 第 0 章提取的全局不变量（路由、分、状态枚举、日上限、错误码前缀）。
B. 再实现 M1。
C. 末尾 Markdown 表三列：文件路径 | 新增或修改 | 一句话职责说明。
```

---

## Prompt 2（M2）

```
继续 Nexus BTT。上一轮应完成 PRD M1。本轮只做 M2，必须复用已实现（或 PRD 规定）的契约，禁止另起炉灶或改路由别名。

规格仍以 docs/NX-PRD-BTT-2026-08.md 为准。实现前先回答（答案在文档不同区段，勿猜）：
A. 周视图完整路由？（第 0.3 / 第 13 章）
B. week_start 合法性与错误码？（第 5.2 / 第 0.9）
C. BTT_MAX_MINUTES_PER_DAY 数值；单日合计是否计入 rejected？（第 0.8）
D. 附录 A：作废旧称、禁止的 storage 前缀、现行 prefs 键？
E. 第 10.2 要求 days 数组长度？

【本轮交付 M2】
1. GET /api/time-entries/week?week_start= ，结构对齐第 10.2；非周一 → BTT_E008。
2. 路由 /time-entries/week：7 列网格；上/下周切换（±7 天且仍为周一）。
3. 格子「+」预填 work_date 创建 draft，成功后刷新周视图。
4. 列表页 ↔ 周视图双向入口。
5. 单日合计 ≥1200 警告；≥1440 禁用该日「+」（前端），后端仍校验 BTT_E002。
6. 计算/API 不得写进纯 UI 页；继续禁止新 npm / 新 Python 依赖。

【回复】先答 A–E → 再写代码 → 末尾变更表（三列）→ 再附一表说明本轮如何复用第 1 轮 API/组件（勿复制第二套）。
```

---

## Prompt 3（M3）

```
继续 BTT，在 M1+M2 上实现 docs/NX-PRD-BTT-2026-08.md 第 7.3 章 M3。跨轮约定仍有效：无新依赖、UI/逻辑分文件、金额用分、状态机、双路由、BTT_E* 与常量名不可改。

【先答后写（回溯早期上下文）】
1. 写出第 0.7 全部 5 个 status 字面量（原序）。
2. 写出第 0.10 全部 7 个事件常量名。
3. 冲销公式（第 8.2）与发票行 description 格式（第 8.3）要点。
4. 列出第 12 章至少 4 条反例，并确认当前未违反。
5. 第 0.11 要求的变更表有几列？列名是什么？

【本轮交付 M3】
1. POST /api/time-entries/{id}/write-off，body { invoice_id }，严格第 8 章；成功 → written_off + 发票可见新行；重复冲销失败。
2. GET /api/time-entries/stats/summary：week_approved_unwritten_minutes、month_written_off_amount_cents。
3. Dashboard 增加标题精确为「Billable Time」的卡片（第 9 章），两指标；点击跳转 /time-entries?status=approved。
4. 列表对 approved+billable 提供 Write off（选发票）；失败展示 BTT_E005/E007 等。
5. 可验证闭环：draft→submit→approve→write-off→Invoices 可见行→Dashboard 变化→周视图终态不可改。

【回复】先答 1–5 → 实现 → 末尾：①变更表 ②「与第 8.3 发票行映射」表 ③三条以内自检：仍遵守无新依赖、分层、状态机/日上限。
```

---

## 字符数自检（约）

| 轮次 | 约字符数 | 说明 |
| :--- | ---: | :--- |
| Prompt 1 | ~1100 | 引用 PRD 文件，不内嵌全文 |
| Prompt 2 | ~900 | 跨轮 needle 抽查 |
| Prompt 3 | ~1000 | 约束回溯 + M3 |

均远低于 6000。长上下文靠：通读整仓 + 通读 `docs/NX-PRD-BTT-2026-08.md`（约 1.2万+ 字）+ 三轮累计。
