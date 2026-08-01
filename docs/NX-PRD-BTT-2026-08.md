# Nexus Product Requirements Document

## 模块：可计费工时追踪与冲销（Billable Time Tracking）

| 字段 | 值 |
| :--- | :--- |
| 文档编号 | NX-PRD-BTT-2026-08 |
| 版本 | v1.0-eval（评测用完整稿） |
| 状态 | Approved for incremental delivery |
| 适用仓库 | client-portal / Nexus（GSB0731） |
| 内部代号 | BTT |
| 中文名 | 可计费工时追踪与冲销 |

> **读者注意**：本文开篇、中段、末尾均含必须遵守的条款。实现 Agent 须通读全文；后续轮次会按「章节编号」抽查，不得只读摘要或只看里程碑清单。

---

## 第 0 章 术语表与全局不变量

0.1 产品中文名：可计费工时追踪与冲销（Billable Time Tracking）

0.2 内部代号：BTT

0.3 前端路由规范（不可更改、不可加别名）：

- 列表与填报主页：必须精确为 `/time-entries`
- 周视图（M2）：必须精确为 `/time-entries/week`
- 禁止使用 `/timesheets`、`/hours`、`/btt`、`/time` 等别名路由

0.4 侧栏文案：英文 UI 使用 `Time Tracking`（与现有英文导航一致）；建议 `data-nav="time-tracking"`。

0.5 金额与费率全局规则：

- 所有货币金额（含 `hourly_rate_cents`、冲销金额）以整数「分」为单位存储与传输
- API JSON 字段名必须带 `_cents` 后缀
- 前端展示：`display = (cents / 100).toFixed(2)`，前缀 `$`；禁止裸分、禁止一位小数、禁止 float 存钱

0.6 工时单位：存储字段为 `duration_minutes`（正整数）。禁止用小时小数作为存储字段。展示时可格式化为 `Hh Mm`。

0.7 状态枚举字符串必须逐字使用（禁止改大小写或换同义词）：

- `draft`
- `submitted`
- `approved`
- `rejected`
- `written_off`

0.8 单日上限常量（前后端同名、同值）：

```
BTT_MAX_MINUTES_PER_DAY = 24 * 60  # 1440
```

同一 `owner_id` + 同一 `work_date` 下，所有 **非 `rejected`** 条目的 `duration_minutes` 合计不得超过 1440。

0.9 错误码（UI 须可见；建议元素带 `data-error-code`）：

| 码 | 含义 |
| :--- | :--- |
| BTT_E001 | `duration_minutes` 非法（≤0 或非整数） |
| BTT_E002 | 超出单日 1440 分钟上限 |
| BTT_E003 | 非法状态流转 |
| BTT_E004 | 非 `draft` 不可编辑正文/时长/日期/费率等字段 |
| BTT_E005 | 仅 `approved` 且 `billable=true` 可冲销 |
| BTT_E006 | 项目不存在或不属于当前用户 |
| BTT_E007 | 冲销时缺少有效 `hourly_rate_cents`（须 >0） |
| BTT_E008 | 周视图 `week_start` 不是 ISO 周一 |

0.10 前端事件/动作常量（若使用常量文件，必须逐字）：

- `btt/entry/CREATE`
- `btt/entry/UPDATE`
- `btt/entry/SUBMIT`
- `btt/entry/APPROVE`
- `btt/entry/REJECT`
- `btt/entry/WRITEOFF`
- `btt/week/LOAD`

0.11 **非代码交付约定**：每一轮实现结束后，回复末尾必须用 Markdown 表格输出三列：`文件路径 | 新增或修改 | 一句话职责说明`。

0.12 **技术栈边界**：禁止新增任何第三方 npm / yarn 依赖；禁止向 `backend/requirements.txt` 增加新依赖。只允许使用仓库已有栈（React、react-router-dom、axios、framer-motion、recharts、lucide-react、FastAPI、SQLAlchemy、Pydantic、python-jose、passlib 等）。禁止为日期处理引入 `dayjs` / `date-fns` / `moment`——使用原生 `Date` 或手写工具函数。

0.13 **架构边界**：

- 前端：页面 UI 与「请求 / 校验 / 状态编排」必须分文件。例如 `pages/TimeEntries.jsx`（或等价）只负责展示；`hooks/useTimeEntries.js` 或 `services/timeEntriesApi.js` 负责 API 与规则。**禁止在页面文件内直接写 axios/fetch。**
- 后端：沿用现有分层习惯（models / schemas / routes 注册于 `main.py`）；业务校验不得写成无结构脚本堆砌。本仓无 Redux，继续用 hooks + Context，不要为 BTT 强行引入 Redux。

0.14 **代码风格**：本模块每一个新增的导出函数（前端 util / hook / service；后端若拆出 helper）必须有 JSDoc 或等价 docstring，至少包含参数与返回说明。

---

## 第 1 章 背景与问题陈述

### 1.1 现状

Nexus 已提供 Clients、Projects（含嵌入式 Tasks）、Invoices、Dashboard。顾问可以管理项目与开票，但缺少「按日记录可计费工时 → 提交/审批 → 冲销进发票行」的闭环。Tasks 上的 `estimated_hours` 只是估算，不能替代真实工时账本。

### 1.2 目标

在不破坏现有发票 / 项目 / 鉴权模型的前提下，新增独立 `TimeEntry` 账本，并最终支持将已审批可计费工时冲销为 Invoice 的一行（M3），金额按分钟与费率用整数运算折算（向下取整到分）。

### 1.3 非目标（本评测明确不做）

- 多人团队审批流、RBAC 角色扩展
- 第三方日历同步（Google Calendar 等）
- PDF / CSV 导出
- 移动端独立 App
- 把 TimeEntry 塞进现有 Task 模型（必须独立表）

### 1.4 成功标准（总览）

用户可在浏览器内完成：创建草稿 → 提交 → 审批 →（M2）周视图查看 →（M3）冲销到发票 → Dashboard 数字变化；全程无新依赖、路由与错误码与本文一致。

---

## 第 2 章 用户故事

| ID | 故事 | 优先级 |
| :--- | :--- | :--- |
| US-01 | 作为已登录顾问，我可为自己的某项目创建工时草稿 | M1 |
| US-02 | 我可将草稿提交为 `submitted`；提交后不可再改时长/日期/描述（除非驳回回 `draft`） | M1 |
| US-03 | 我可审批（`approved`）或驳回（`rejected`）自己的 `submitted` 条目（单用户演示允许自批；勿引入新角色系统） | M1 |
| US-04 | 我可在周视图按周一为起点查看 7 天格子 | M2 |
| US-05 | 我可将 `approved` + `billable` 条目一键冲销到指定发票；成功后状态 `written_off`，发票增加一行 | M3 |
| US-06 | Dashboard 展示「本周已审批未冲销分钟数」与「本月已冲销金额」 | M3 |

---

## 第 3 章 领域模型

### 3.1 TimeEntry（表名建议 `time_entries`）

| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | Integer PK | | |
| owner_id | Integer FK → users | required, index | 当前登录用户 |
| project_id | Integer FK → projects | required, index | 必须属于该 owner |
| work_date | Date / String(YYYY-MM-DD) | required | 工作发生日 |
| duration_minutes | Integer | > 0 | 时长（分钟） |
| description | Text | trim 后 1..500 | 工作说明；上限常量 `BTT_DESC_MAX = 500` |
| billable | Boolean | default true | 是否可计费 |
| hourly_rate_cents | Integer | >= 0, nullable | 可计费冲销时必须 > 0 |
| status | String enum | 见 0.7 | |
| reject_reason | Text | nullable | `rejected` 时可填 |
| invoice_id | Integer FK → invoices | nullable | 冲销后回写 |
| written_off_at | DateTime | nullable | 冲销时间 |
| created_at | DateTime | | |
| updated_at | DateTime | | |

### 3.2 派生只读字段（API 可计算返回，不必落库）

```
amount_cents = (duration_minutes * hourly_rate_cents) // 60
```

当 `billable=false` 或 `hourly_rate_cents` 为空时返回 `null`。必须用整数运算，禁止 float。

### 3.3 索引建议

- `(owner_id, work_date)`
- `(project_id, status)`
- **不做**「同项目同日唯一」——允许同一天多条记录

### 3.4 与现有模型关系

- **Project**：只读关联；不修改项目进度计算公式
- **Invoice**：M3 写入行项目；不改变现有发票状态枚举名
- **Task**：无关；禁止把 TimeEntry 字段塞进 Task

---

## 第 4 章 状态机（硬规则）

### 4.1 合法迁移

| From | To | 触发 |
| :--- | :--- | :--- |
| draft | submitted | transition API |
| submitted | approved | transition API |
| submitted | rejected | transition API（可带 reject_reason） |
| rejected | draft | transition API（允许修改后重提） |
| approved | written_off | **仅** write-off API；禁止直接 PATCH status |

`written_off` 为终态，禁止任何修改 / 删除 / 再迁移。

### 4.2 非法示例（必须返回 BTT_E003）

- `draft` → `approved`（跳过 submitted）
- `approved` → `draft`
- `written_off` → 任何状态
- `submitted` → `draft`（必须先 `rejected`）
- 直接把 status 改成 `written_off`

### 4.3 编辑与删除规则

- **仅** `status=draft` 可修改：`project_id`、`work_date`、`duration_minutes`、`description`、`billable`、`hourly_rate_cents`
- 非 draft 修改上述字段 → `BTT_E004`
- **可删除**：`draft`、`rejected`
- 其它状态删除 → `BTT_E003` 或 HTTP 409（项目内保持一致即可）

---

## 第 5 章 HTTP API

统一前缀：`/api/time-entries`（复数、连字符）。全部端点需登录，鉴权方式与现有 JWT 一致。

### 5.1 M1 必须实现

**1) POST `/api/time-entries`**

- body: `{ project_id, work_date, duration_minutes, description, billable?, hourly_rate_cents? }`
- 默认 `status=draft`
- 校验：时长、描述长度、项目归属、单日上限
- 失败时在响应中带上对应 `BTT_E00x`（例如 `detail.code`）

**2) GET `/api/time-entries`**

- query: `project_id?`, `status?`, `date_from?`, `date_to?`, `billable?`
- 仅返回当前用户；排序：`work_date desc`, `id desc`

**3) GET `/api/time-entries/{id}`**

**4) PUT `/api/time-entries/{id}`**

- 仅 draft 可更新字段（见第 4 章）

**5) DELETE `/api/time-entries/{id}`**

- 仅 draft / rejected

**6) POST `/api/time-entries/{id}/transition`**

- body: `{ to_status, reject_reason? }`
- 执行状态机；`to_status` **不得**为 `written_off`（冲销走专用接口）

### 5.2 M2 必须实现

**7) GET `/api/time-entries/week`**

- query: `week_start=YYYY-MM-DD`
- `week_start` 必须是 ISO 周一，否则 `BTT_E008`
- 响应结构见第 10.2

### 5.3 M3 必须实现

**8) POST `/api/time-entries/{id}/write-off`**

- body: `{ invoice_id }`
- 规则见第 8 章

**9) GET `/api/time-entries/stats/summary`**

- 返回至少：
  - `week_approved_unwritten_minutes`：本周（周一至今）`approved` 且尚未冲销的分钟合计
  - `month_written_off_amount_cents`：本月已冲销金额（分）

---

## 第 6 章 前端 M1 交互规格

6.1 侧栏：在 Invoices 下方插入 `Time Tracking`，激活态样式跟随现有 `Sidebar`。

6.2 列表页 `/time-entries`：

- 顶部：筛选（项目、状态、日期范围）+ 「New Entry」按钮
- 表格列：Date | Project | Duration | Billable | Rate | Status | Amount | Actions
- Amount 列按 0.5 规则展示；非 billable 显示 `—`
- Actions 按状态显隐：Edit（仅 draft）、Submit、Approve、Reject、Delete

6.3 新建/编辑 Modal：字段与 API 对齐；失败时展示错误码文本（至少覆盖 BTT_E001 / E002）。

6.4 空态：无数据时给出引导，并提供通往 `/projects` 的链接。

6.5 列表与周视图（M2）须有双向导航入口。

---

## 第 7 章 里程碑切分

### 7.1 M1 — 账本基础

落实第 0、3、4、5.1、6 章：模型 + schema + CRUD + transition + 列表页 + 侧栏。  
可选：扩展 `POST /api/seed` 增加 ≥3 条不同状态样例（非必须）。

### 7.2 M2 — 周视图

落实第 5.2、10 章：week API + `/time-entries/week` 七列网格 + 从格子快速创建 draft。必须复用 M1 契约，禁止平行再造一套 API。

### 7.3 M3 — 冲销与仪表盘

落实第 5.3、8、9 章：write-off、发票行写入、Dashboard 卡片、stats summary。

---

## 第 8 章 冲销业务（M3；M1/M2 勿实现，但字段与公式须记住）

8.1 前置条件：`status=approved` 且 `billable=true` 且 `hourly_rate_cents > 0`；否则 `BTT_E005` / `BTT_E007`。

8.2 金额计算（整数）：

```
amount_cents = (duration_minutes * hourly_rate_cents) // 60
```

8.3 行为：

1. 校验 `invoice` 属于当前用户  
2. 在该发票的 items / 行项目结构中追加一行：
   - `description` 格式必须为：  
     `BTT#{entry.id} {work_date} · {原 description 截断至 80 字符}`
   - 若现有发票模型以 float 美元存金额，则写入 `dollars = amount_cents / 100`，但 TimeEntry 侧仍保持「分」
3. `TimeEntry.status → written_off`；写入 `invoice_id`、`written_off_at`

8.4 幂等：已 `written_off` 再次调用必须失败（`BTT_E003`），不可重复追加发票行。

---

## 第 9 章 Dashboard 卡片（M3）

9.1 卡片标题精确为：`Billable Time`

9.2 指标 A：`Approved not written-off (this week)` → 显示分钟；可额外显示小时两位小数

9.3 指标 B：`Written-off amount (this month)` → `$x.xx`

9.4 点击卡片跳转：`/time-entries?status=approved`

9.5 卡片须接入现有 Dashboard 布局与主题变量，不要另起一套视觉体系。

---

## 第 10 章 周视图规则（M2）

10.1 `week_start` 必须为 ISO 周一（Monday）。

10.2 响应结构（字段名冻结）：

```json
{
  "week_start": "YYYY-MM-DD",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "total_minutes": 0,
      "entries": []
    }
  ]
}
```

`days` 必须恰好 **7** 个元素，按日期升序，从 `week_start` 到 +6 天。

10.3 UI 规格：

- 7 列网格；每日显示 `total_minutes` 与条目摘要（描述截断）
- 支持上一周 / 下一周（`week_start ± 7` 天，结果仍须是周一）
- 点击「+」预填该日 `work_date` 并创建 draft
- 当某日合计 ≥ **1200** 分钟：警告样式
- 当某日合计 ≥ **1440** 分钟：禁用该日「+」（前端）；后端仍返回 `BTT_E002`

10.4 周视图页面不得直接 axios；复用 M1 的 service/hook。

---

## 第 11 章 观测与日志（可选，命名冻结）

若打印调试日志，事件名必须使用：

- `btt_entry_created`
- `btt_transition`
- `btt_writeoff_success`

可用 `console.debug` / `logging.info`，禁止引入新日志框架。

---

## 第 12 章 反例清单（禁止事项）

1. 用 float / Decimal 字符串存 `hourly_rate`（必须整数分 + `_cents` 后缀）
2. 新增任何 npm 包或 Python 包（含 UI 库、日期库）
3. 在 `pages/*TimeEntr*` 内直接写 axios/fetch
4. 路由写成 `/timesheet`、`/timesheets`、`/btt`
5. 状态使用 `pending` / `done` / `completed` 等替代词
6. 冲销时只改发票 total 却不写行项目（M3）
7. 为 BTT 新建第二套鉴权或绕过现有 JWT
8. 把 TimeEntry 合并进 Task 模型
9. M2/M3 重新发明与 M1 不兼容的字段名
10. 使用已作废的旧命名（见附录 A）

---

## 第 13 章 常量速查（字面量冻结）

```text
BTT_MAX_MINUTES_PER_DAY = 1440
BTT_DESC_MAX = 500
BTT_WARN_MINUTES_PER_DAY = 1200
BTT_ROUTE_LIST = "/time-entries"
BTT_ROUTE_WEEK = "/time-entries/week"
BTT_ERROR_PREFIX = "BTT_E"
BTT_NAV_LABEL = "Time Tracking"
```

状态字面量（再次强调）：`draft` | `submitted` | `approved` | `rejected` | `written_off`

---

## 附录 A 修订历史与作废命名

| 日期 | 说明 |
| :--- | :--- |
| 2026-08-01 | 初稿。旧称「Timesheet Lab / TS」**作废**。 |
| 2026-08-01 | 禁止使用 storage key 前缀 `nexus:ts:*`。 |
| 2026-08-01 | 若需 localStorage（非必须），键名只能是 `nexus:btt:prefs:v1`。 |

抽查用 needle（后续轮次可能提问）：

- 作废模块旧称：`Timesheet Lab` / `TS`
- 禁止的 storage 前缀：`nexus:ts:`
- 现行 prefs 键：`nexus:btt:prefs:v1`

---

## 附录 B 与现有模块集成要点

### B.1 鉴权

复用 `get_current_user`（或仓库等价依赖）；所有 BTT 路由挂在同一 APIRouter 前缀下并在 `main.py` include。

### B.2 前端路由注册

在 `App.jsx` 的 ProtectedRoute 下增加：

- `/time-entries` → 列表页
- `/time-entries/week` → 周视图（M2）

### B.3 发票行写入适配

先阅读现有 `Invoice` 模型与创建/更新 API：若 invoices 使用 JSON/关联表存 line items，按现有结构追加；若仅有 amount 字段，则需在不破坏旧数据前提下扩展最小行项目能力（优先贴合现有 schema，避免大重构）。

### B.4 主题与动效

使用现有 CSS 变量（`--accent-primary` 等）与可选 framer-motion；不要引入新的设计系统。

---

## 附录 C 验收清单

### C.1 M1

- [ ] 侧栏可进入 `/time-entries`
- [ ] 可创建 draft；列表展示费率 `$x.xx`
- [ ] 同日已有 1200 分钟后再加 300 → `BTT_E002`
- [ ] `draft→submitted→approved` 成功；`draft→approved` 失败（`BTT_E003`）
- [ ] 无新依赖；UI/API 分文件；回复末尾有三列变更表

### C.2 M2

- [ ] `/time-entries/week` 可切换周；`days.length === 7`
- [ ] 非周一 `week_start` → `BTT_E008`
- [ ] 格子「+」预填日期；≥1440 日禁用
- [ ] 复用 M1 service/hook，无平行 API

### C.3 M3

- [ ] approved+billable 可 write-off 到发票；发票可见 `BTT#...` 行
- [ ] 重复冲销失败
- [ ] Dashboard「Billable Time」两指标正确
- [ ] 闭环：列表 ↔ 周视图 ↔ 发票 ↔ Dashboard 均可验证

---

## 附录 D 示例数据（便于手工验收）

假设项目 P1 存在，费率 `15000` 分/小时（$150.00）：

| work_date | minutes | status | billable | 期望 amount_cents |
| :--- | ---: | :--- | :--- | ---: |
| 本周一 | 90 | draft | true | 22500 |
| 本周一 | 60 | submitted | true | 15000 |
| 本周三 | 120 | approved | true | 30000 |
| 本周四 | 45 | approved | false | null |

冲销第三行后：发票行描述形如 `BTT#3 2026-08-05 · ...`，金额 $300.00（若发票侧为美元）。

---

## 附录 E 推荐文件落位（非强制路径，但职责分离强制）

```text
backend/
  models.py          # 增加 TimeEntry
  schemas.py         # TimeEntryCreate/Update/Out/Transition/WriteOff
  main.py            # 注册 /api/time-entries*

frontend/src/
  services/timeEntriesApi.js   # 或 hooks/useTimeEntries.js
  pages/TimeEntries.jsx
  pages/TimeEntriesWeek.jsx    # M2
  components/Sidebar.jsx       # 增导航
  pages/Dashboard.jsx          # M3 卡片
  App.jsx                      # 增路由
```

页面文件禁止直接 axios；金额格式化可放 `utils/bttMoney.js` 并导出带 JSDoc 的函数。

---

## 附录 F 错误响应约定（与抽查相关）

建议统一：

```json
{
  "detail": {
    "code": "BTT_E002",
    "message": "Daily limit of 1440 minutes exceeded"
  }
}
```

若必须贴合现有 FastAPI 字符串 `detail` 风格，则 message 中必须 **包含** 错误码子串 `BTT_E002`，以便前端与评测识别。

---

## 附录 G 跨轮记忆检查点（出题/评分用）

评测后续轮次可能询问：

1. 第 0.3 两个精确路由
2. 第 0.8 单日上限是否计入 `rejected`
3. 第 0.10 七个事件常量
4. 第 8.3 description 模板
5. 附录 A 作废名与现行 prefs 键
6. 第 12 章反例是否仍被遵守
7. 第 10.2 `days` 长度

实现者应确保早期约定在长对话后仍可被检索与遵守，而不是重新发明一套「差不多」的命名。

---

**文档结束（NX-PRD-BTT-2026-08）**
