# 🌸 花言葉 v1.0

**想いにぴったりの花を見つけよう**

花の名前・花言葉・気持ち・贈る相手・シーン・五十音から花を探せる「花言葉図鑑」Webアプリです。
iPhone での利用を最優先にした、静的ファイルだけで動く SPA です（サーバー・npm 不要）。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面の骨組み・アイコン / manifest の設定 |
| `style.css` | デザイン（safe-area・横画面・PC 対応） |
| `app.js` | 画面遷移・検索・今日の花・お気に入り・シェア（バージョン情報 `APP.version` もここ） |
| `flowers.js` | 花データ（70種類）。花の追加・修正はここだけ |
| `categories.js` | 気持ち・贈る相手・シーン・五十音の定義 |
| `manifest.json` | ホーム画面追加 / PWA 用設定 |
| `flower-icon.png` / `flower-icon-192.png` | アプリアイコン |
| `images/flowers/` | 花の写真フォルダ（`<id>.webp` を置くと自動表示） |

## 花を追加するには

`flowers.js` の配列に 1 件追加します（項目の説明はファイル冒頭のコメントを参照）。

## 公開（GitHub Pages）

Settings → Pages → Branch を選んで `/ (root)` を指定するだけで公開できます。

※ 花言葉には諸説があります。
