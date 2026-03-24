# 彩券行管理系統

彩券行日常營運管理工具，包含排班、結帳、庫存盤點、月報表等功能。

## 技術架構

| 項目 | 內容 |
|------|------|
| 框架 | Next.js 16 App Router + Turbopack |
| 資料庫 | PostgreSQL（Supabase 雲端托管）|
| ORM | Prisma（schema-first，`prisma db push`）|
| 樣式 | Tailwind CSS v4 |
| 部署 | Vercel（或本機 `npm run dev`）|

---

## 功能模組

### 結帳 `/checkout`
每日收盤作業。

- 刮刮樂盤點：依地板庫存自動計算各票種售出張數與金額
- 彩券、運彩銷售與兌獎手動輸入
- 額外項目（自訂名稱金額）
- 現金清點與差額計算
- 列印收據格式

### 地板庫存 `/floor-inventory`
每日盤點刮刮樂陳列量。

- 記錄各票種未拆封書、已拆書、陳列張數
- 補書按鈕：補入未拆封書，同步在庫存管理新增 OUT 紀錄
- 拖曳排序票種顯示順序

### 庫存管理 `/inventory`
刮刮樂進貨（IN）與取用（OUT）流水帳。

### 月報表 `/monthly`
當月銷售總覽與傭金試算。

- 每日銷售表（彩券 / 刮刮樂 / 運彩 / 虛擬運彩 / 總營業額）
- 編輯模式：可直接修改各欄位，存入資料庫
- 刮刮樂金額優先使用手動輸入值；未輸入則自動從地板庫存計算
- 刮刮樂月總張數：由結帳頁每日自動存入，累加得出
- 右側項目明細：固定傭金列（彩券 8%、刮刮樂 9%、運彩 6.25%）+ 自訂項目
- 公版範本：設定好後每月自動帶入
- 列印：A4 橫向黑白，左側日報、右側傭金明細

### 刮刮樂種類 `/scratch`
管理目前在售的刮刮樂票種（名稱、單價、每本張數）。

### 員工管理 `/employees`
員工資料與排班設定。

### 排班表 `/settings`
週班表 Grid。拖拉員工到時段，支援 RWD。

---

## 環境變數

```env
DATABASE_URL=           # Supabase PostgreSQL 連線字串（pgbouncer）
DIRECT_URL=             # 直連字串（prisma db push 使用）
AUTH_SECRET=            # HMAC 簽章密鑰
AUTH_PASSWORD=          # 登入密碼
NEXT_PUBLIC_STORE_NAME= # 店家名稱（顯示於登入頁）
```

---

## 本機啟動

```bash
npm install
npx prisma db push      # 同步 schema 到資料庫
npm run dev             # 預設 http://localhost:3000
```

---

## 資料模型重點說明

### 刮刮樂售出計算公式
```
sold = yesterdayDisplay + supplement + restockSheets - todayDisplay

supplement = (昨日未拆封 - 今日未拆封) × sheetsPerBook
           + (昨日已拆書 - 今日已拆書)
```

### scratchSales 資料來源優先順序
1. `DailySummary.scratchSales`（nullable）— 月報表手動輸入，有值優先
2. 地板庫存盤點計算 — 無手動值時 fallback

### scratchSheets 資料來源
- 結帳頁每次載入時，將計算結果自動存入 `DailySummary.scratchSheets`
- 月報表加總各日 scratchSheets 得出月總張數

---

## 認證機制

單一帳號密碼。登入流程：

1. POST `/api/auth/login`：比對 `AUTH_PASSWORD` 環境變數
2. 驗證通過：計算 `HMAC-SHA256(AUTH_SECRET, AUTH_PASSWORD)` 作為 token，設為 httpOnly cookie（有效期 30 天）
3. `proxy.ts`（等同 middleware）：每個請求驗證 cookie，不符合導向 `/login`
