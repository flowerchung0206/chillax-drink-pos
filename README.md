# 蕎淶清飲 POS

前台點餐 (`front.html`) + 後廚出單看板 (`kitchen.html`)，透過 Firebase Realtime Database 即時同步。

## 部署到 Netlify（用 GitHub 串接，之後改程式碼會自動重新部署）

1. 把這個資料夾整個推上一個新的 GitHub repo
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin <你的 repo 網址>
   git push -u origin main
   ```
2. 到 [Netlify](https://app.netlify.com) → **Add new site → Import an existing project**
3. 選剛剛那個 GitHub repo，Netlify 會自動抓到：
   - Build command: `npm run build`
   - Publish directory: `dist`
   （這些已經寫在 `netlify.toml` 裡了，不用手動填）
4. 點 Deploy，等個 1-2 分鐘完成後會拿到一個 `xxx.netlify.app` 網址
5. 打開 `你的網址/front.html` 是前台，`你的網址/kitchen.html` 是後廚看板
   - 也可以到 Netlify 後台把根目錄 `/` 設定重導向到 `/front.html`，或直接把這兩個網址分別做成書籤 / 加到 iPad 主畫面

如果不想用 GitHub，也可以本機執行 `npm install && npm run build`，把產生的 `dist` 資料夾直接拖進 Netlify 網頁上的「Deploy manually」區塊。

## Firebase Realtime Database 規則

目前這個 App 沒有登入機制，前台跟後廚都是直接讀寫資料庫。麻煩到 Firebase 主控台 → Realtime Database → 「規則」，確認是類似下面這樣可以公開讀寫（測試模式通常有 30 天到期日，到期後會讀寫失敗）：

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ 這代表任何拿到你資料庫網址的人理論上都能讀寫資料——對展場這種短期使用沒什麼問題，但不建議長期正式營運用這組規則，之後有需要可以再幫你加簡單的密碼保護。

## 資料結構

- `pos/products` — 品項與價格
- `pos/config` — 店名、套組折扣金額
- `pos/cart` — 前台目前進行中的訂單（未結帳）
- `pos/orders` — 已送出的訂單列表（前台結帳寫入，後廚更新製作狀態）
