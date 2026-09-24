#!/usr/bin/env node
/*
 * 花言葉 — データ整合性チェック（開発用）
 *
 *   node tools/check-data.js
 *
 * npm install は不要です。アプリの画面には何も表示しません。
 * flowers.js / birthdays.js / categories.js を読み込み、重複や参照切れを確認します。
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
['categories.js', 'flowers.js', 'birthdays.js'].forEach((f) => require(path.join(root, f)));

const TAX = window.HANA_TAXONOMY;
const FLOWERS = window.HANA_FLOWERS;
const BIRTHDAYS = window.HANA_BIRTHDAYS;

// v1.0 から存在する花の id（お気に入りの互換性のため、変更・削除しない）
const V1_IDS = ['ivy','morning-glory','hydrangea','anemone','amaryllis','alstroemeria','iris','plum','edelweiss','carnation','gerbera','babys-breath','calla','kalanchoe','bellflower','chrysanthemum','osmanthus','gardenia','christmas-rose','clematis','crocus','clover','celosia','cosmos','moth-orchid','sasanqua','cherry-blossom','saffron','peony','aster','daphne','sweet-pea','lily-of-the-valley','snowdrop','violet','statice','globe-amaranth','dahlia','dandelion','tulip','camellia','daisy','lisianthus','dianthus','rape-blossom','nemophila','hibiscus','dogwood','ornamental-cabbage','rose','pansy','red-spider-lily','hyacinth','sunflower','viola','wisteria','freesia','blue-star','tree-peony','poinsettia','poppy','marguerite','marigold','mimosa','muscari','lily','lilac','lavender','gentian','forget-me-not'];

const errors = [];
const warns = [];
const err = (m) => errors.push(m);

// 表記ゆれを吸収した比較用キー（アプリの検索と同じ考え方）
const norm = (s) => String(s).normalize('NFKC').toLowerCase()
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[\s　・「」『』。、．，.,!！?？'"〜~ー―-]/g, '');

// ---- 花 ----
const ids = new Map();
const names = new Map();
FLOWERS.forEach((f, i) => {
  const where = f.id || '#' + i;
  ['id', 'name', 'kana'].forEach((k) => { if (!f[k]) err(where + ': ' + k + ' がありません'); });
  if (!Array.isArray(f.meanings) || !f.meanings.length) err(where + ': 花言葉 (meanings) がありません');
  if (ids.has(f.id)) err('id が重複: ' + f.id);
  ids.set(f.id, f);
  if (f.kana && !/^[ぁ-ゖー]+$/.test(f.kana)) err(where + ': kana はひらがなで書いてください (' + f.kana + ')');

  // 名前・別名が、ほかの花と重なっていないか（同じ植物の重複登録を防ぐ）
  const own = new Set();
  [f.name].concat(f.aliases || []).forEach((n) => {
    const k = norm(n);
    if (own.has(k)) err(where + ': 名前と別名、または別名どうしが重複: ' + n);
    own.add(k);
    if (names.has(k) && names.get(k) !== f.id) err('同じ名前・別名が別の花にあります: ' + n + ' (' + names.get(k) + ' / ' + f.id + ')');
    names.set(k, f.id);
  });

  const dupCheck = (list, label) => {
    const seen = new Set();
    (list || []).forEach((m) => {
      const k = norm(m);
      if (seen.has(k)) err(where + ': ' + label + 'が重複: ' + m);
      seen.add(k);
    });
  };
  dupCheck(f.meanings, '花言葉');
  (f.colorMeanings || []).forEach((c) => dupCheck(c.meanings, '色別花言葉(' + c.color + ')'));
  dupCheck((f.colorMeanings || []).map((c) => c.color), '色');

  (f.bloomingMonths || []).forEach((m) => { if (!(m >= 1 && m <= 12)) err(where + ': bloomingMonths が不正: ' + m); });
  const check = (list, tax, label) => (list || []).forEach((x) => { if (!tax.some((t) => t.id === x)) err(where + ': 存在しない' + label + ' id: ' + x); });
  check(f.categories, TAX.feelings, '気持ち');
  check(f.recipients, TAX.recipients, '贈る相手');
  check(f.scenes, TAX.scenes, 'シーン');
});

// 同じ読みの花（別名の登録もれの可能性）
const kanas = new Map();
FLOWERS.forEach((f) => {
  if (kanas.has(f.kana)) warns.push('同じ読みの花があります: ' + f.kana + ' (' + kanas.get(f.kana) + ' / ' + f.id + ')');
  kanas.set(f.kana, f.id);
});

V1_IDS.forEach((id) => { if (!ids.has(id)) err('v1.0 の花 id が見つかりません（お気に入りが消えます）: ' + id); });

// ---- 誕生花 ----
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const expected = [];
DAYS.forEach((n, m) => { for (let d = 1; d <= n; d++) expected.push(String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')); });
expected.forEach((md) => {
  const list = BIRTHDAYS[md];
  if (!Array.isArray(list) || !list.length) { err('誕生花の日付が欠けています: ' + md); return; }
  const seen = new Set();
  list.forEach((id) => {
    if (!ids.has(id)) err(md + ': flowers.js に存在しない花 id: ' + id);
    if (seen.has(id)) err(md + ': 同じ花が重複: ' + id);
    seen.add(id);
  });
});
Object.keys(BIRTHDAYS).forEach((k) => { if (!expected.includes(k)) err('不正な日付キー: ' + k); });
if (!BIRTHDAYS['02-29']) err('2月29日のデータがありません');

const used = new Set([].concat(...Object.values(BIRTHDAYS)));
console.log('花: ' + FLOWERS.length + '種類（v1.0 から ' + V1_IDS.length + '種類、追加 ' + (FLOWERS.length - V1_IDS.length) + '種類）');
console.log('誕生花: ' + Object.keys(BIRTHDAYS).length + '日分（2月29日を含む）／誕生花に登場する花 ' + used.size + '種類');
warns.forEach((w) => console.log('注意: ' + w));
if (errors.length) {
  errors.forEach((e) => console.error('エラー: ' + e));
  console.error(errors.length + '件のエラーがあります');
  process.exit(1);
}
console.log('OK: データに問題はありません');
