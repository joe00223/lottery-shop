# 彩券行管理系統

Next.js 15 + Prisma + Supabase (PostgreSQL) + Tailwind CSS

---

## 功能模組

| 路由 | 功能 |
|------|------|
| `/` | 首頁 / 儀表板 |
| `/schedule` | 排班表（週視圖，可拖拉編輯班次） |
| `/inventory` | 現場庫存管理（補張、未開封） |
| `/checkout` | 結帳表 |
| `/employees` | 員工管理（新增 / 編輯 / 刪除） |
| `/employees/[id]` | 員工薪資單（班次明細 + 時薪計算 + 逐日調整 + 列印） |
| `/employees/combined` | 合併薪資單（兩人並排，A4 列印） |

---

## 技術架構

- **框架**：Next.js 15 App Router（params 為 `Promise`，需 `await`）
- **ORM**：Prisma（schema 在 `prisma/schema.prisma`）
- **資料庫**：Supabase PostgreSQL，部署於 AWS ap-northeast-2，**時區為 UTC**
- **樣式**：Tailwind CSS v4，含 `print:` variants

---

## 時區重要說明

`Schedule.weekStart` 由瀏覽器（台灣 UTC+8）寫入，值為台灣週一午夜 = **UTC 前一天 16:00**。

伺服器端處理工時時，**不能用本地 Date 方法**（伺服器時區不確定），必須：

```ts
// 正確：明確指定 Asia/Taipei
function toTwDateStr(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
// 日期加法用 Date.UTC，避免本地時區介入
const actual = new Date(Date.UTC(wy, wm, wd + offset))
```

相關實作：`app/api/employees/[id]/hours/route.ts`

---

## 排班資料結構

```prisma
model Schedule {
  weekStart  DateTime  // 當週週一（台灣），UTC 儲存
  dayOfWeek  Int       // 1=週一 … 6=週六，0=週日
  hour       Int       // 0–23
  rowIndex   Int       // 支援同一時段多人
  employeeId Int?
}
```

`dayOfWeek` 對應：`dayOfWeekMap = [1,2,3,4,5,6,0]`（索引 = rowIndex % 7，值 = dayOfWeek）

---

## 薪資單列印

- 個人薪資單：`/employees/[id]` → 點「列印薪資單」
- 合併薪資單：`/employees/combined` → 點「列印（A4）」
  - 兩張薪資單並排（`flex-direction: row`）
  - 時段欄在列印時隱藏（`print:hidden`）以節省橫向空間
  - 底部顯示兩人薪資合計

---

## 啟動開發

```bash
npm run dev
```

確認 `.env` 已設定 `DATABASE_URL`（Supabase 連線字串）。
