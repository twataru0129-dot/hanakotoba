/*
 * 花言葉 — アプリ本体
 * 静的ファイルのみで動作する SPA（ハッシュルーティング）です。
 */
(function () {
  'use strict';

  /* =========================================================
   * 設定
   * ======================================================= */
  const APP = {
    name: '花言葉',
    subtitle: '想いにぴったりの花を見つけよう',
    version: '1.1.0',
    versionLabel: 'v1.1',
    // 写真: images/flowers/<id>.<ext> を置くと自動で表示されます。
    // 花データに image: 'rose.jpg' のように書くと個別に指定できます。
    photoDir: 'images/flowers/',
    photoExt: 'webp',
    usePhotos: true,
    storageKey: 'hanakotoba.favorites.v1',
    referenceUrl: 'https://andplants.jp/blogs/magazine/flowerlanguage-list',
    birthdayReferenceUrl: 'https://hananokotoba.com/calendar/'
  };

  const TAX = window.HANA_TAXONOMY;
  const RAW = window.HANA_FLOWERS || [];
  const BIRTHDAYS = window.HANA_BIRTHDAYS || {};

  /* =========================================================
   * ユーティリティ
   * ======================================================= */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // 検索用の正規化：全角/半角・大文字/小文字・カタカナ/ひらがなの違いを吸収
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s　]+/g, '');
  }

  function queryTerms(q) {
    return String(q || '').normalize('NFKC').split(/[\s　]+/).map(norm).filter(Boolean);
  }

  const quote = (arr) => arr.map((m) => `「${m}」`).join('');

  const byIdIn = (list) => list.reduce((m, x) => { m[x.id] = x; return m; }, {});
  const feelingMap = byIdIn(TAX.feelings);
  const recipientMap = byIdIn(TAX.recipients);
  const sceneMap = byIdIn(TAX.scenes);
  const kanaRowMap = byIdIn(TAX.kanaRows);

  /* =========================================================
   * データの準備（起動時に一度だけ索引を作成）
   * ======================================================= */
  const collator = new Intl.Collator('ja');
  const FLOWERS = RAW.slice().sort((a, b) => collator.compare(a.kana, b.kana));
  const FLOWER_MAP = byIdIn(FLOWERS);

  // 読みの先頭文字（濁点・半濁点を外した清音）
  function headKana(kana) {
    const c = norm(kana).charAt(0).normalize('NFD').replace(/[゙゚]/g, '');
    return c;
  }

  // 花言葉の重複判定用：空白・全角半角・句読点・記号の違いを無視
  const meaningKey = (m) => norm(m).replace(/[。、．，.,!！?？・「」『』"'〜~ー―-]/g, '');
  function uniqueMeanings(list) {
    const seen = new Set();
    return list.map((m) => String(m).trim()).filter((m) => {
      const k = meaningKey(m);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // 誕生花：birthdays.js（日付 → 花 id）から「花 id → 日付」を逆引き
  const BIRTH_DATES = {};
  Object.keys(BIRTHDAYS).sort().forEach((md) => {
    (BIRTHDAYS[md] || []).forEach((id) => { (BIRTH_DATES[id] = BIRTH_DATES[id] || []).push(md); });
  });

  FLOWERS.forEach((f, i) => {
    f.aliases = f.aliases || [];
    f.meanings = uniqueMeanings(f.meanings || []);
    f.colorMeanings = (f.colorMeanings || []).map((c) => Object.assign({}, c, { meanings: uniqueMeanings(c.meanings || []) }));
    f.categories = f.categories || [];
    f.recipients = f.recipients || [];
    f.scenes = f.scenes || [];
    f.bloomingMonths = f.bloomingMonths || [];
    f.birthDates = BIRTH_DATES[f.id] || [];
    f._order = i;
    f._name = [f.name, f.kana].concat(f.aliases).map(norm).join(' ');
    const allMeanings = f.meanings.concat(...f.colorMeanings.map((c) => c.meanings));
    f._allMeanings = uniqueMeanings(allMeanings);
    f._meaning = norm(f._allMeanings.join(' '));
    f._category = norm([
      ...f.categories.map((id) => feelingMap[id] && feelingMap[id].label),
      ...f.recipients.map((id) => recipientMap[id] && recipientMap[id].label),
      ...f.scenes.map((id) => sceneMap[id] && sceneMap[id].label)
    ].filter(Boolean).join(' '));
    f._head = headKana(f.kana);
    f._row = (TAX.kanaRows.find((r) => r.chars.includes(f._head)) || TAX.kanaRows[0]).id;
  });

  /**
   * 検索。mode: 'all'（名前・読み・花言葉・カテゴリー） / 'meaning'（花言葉のみ）
   * 名前一致 → 花言葉一致 → カテゴリー一致 の順に並べます。
   */
  function search(q, mode) {
    const terms = queryTerms(q);
    if (!terms.length) return [];
    const out = [];
    for (const f of FLOWERS) {
      let score = 0;
      let ok = true;
      for (const t of terms) {
        let s;
        if (mode === 'meaning') {
          s = f._meaning.includes(t) ? 1 : -1;
        } else if (f._name.startsWith(t)) s = 0;
        else if (f._name.includes(t)) s = 1;
        else if (f._meaning.includes(t)) s = 2;
        else if (f._category.includes(t)) s = 3;
        else s = -1;
        if (s < 0) { ok = false; break; }
        score += s;
      }
      if (ok) out.push({ f, score });
    }
    out.sort((a, b) => a.score - b.score || a.f._order - b.f._order);
    return out.map((r) => r.f);
  }

  /* =========================================================
   * お気に入り（localStorage）
   * ======================================================= */
  const Favorites = {
    set: new Set(),
    load() {
      try {
        const v = JSON.parse(localStorage.getItem(APP.storageKey) || '[]');
        if (Array.isArray(v)) this.set = new Set(v.filter((id) => FLOWER_MAP[id]));
      } catch (e) { this.set = new Set(); }
    },
    save() {
      try { localStorage.setItem(APP.storageKey, JSON.stringify(Array.from(this.set))); } catch (e) { /* 保存できない環境でも動作は継続 */ }
    },
    has(id) { return this.set.has(id); },
    toggle(id) {
      if (this.set.has(id)) this.set.delete(id); else this.set.add(id);
      this.save();
      return this.set.has(id);
    },
    list() { return FLOWERS.filter((f) => this.set.has(f.id)); }
  };

  /* =========================================================
   * 今日の花（同じ日は同じ花、日付が変わると別の花）
   * ======================================================= */
  function localDayNumber(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // id 順に固定した並びをシャッフルし、日ごとに1つずつ進める（連続する日で同じ花にならない）
  // 贈り物に向かない花（recipients が空）は「今日の花」には出しません
  const TODAY_ORDER = seededShuffle(FLOWERS.filter((f) => f.recipients.length).map((f) => f.id).sort(), 20260401);
  function todaysFlower(date) {
    const d = date || new Date();
    const n = TODAY_ORDER.length;
    const idx = ((localDayNumber(d) % n) + n) % n;
    return FLOWER_MAP[TODAY_ORDER[idx]];
  }
  const dateKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const dateLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;

  /* =========================================================
   * 誕生花・月（日付は年に依存しない "MM-DD" で扱う）
   * ======================================================= */
  const pad2 = (n) => String(n).padStart(2, '0');
  // 誕生花検索用：2月は常に29日まで選べる
  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // 端末のローカル日付から MM-DD を作る（UTC に変換しないのでタイムゾーンずれが起きない）
  const mdOf = (d) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function parseMD(md) {
    const m = /^(\d{2})-(\d{2})$/.exec(md || '');
    if (!m) return null;
    const month = +m[1];
    const day = +m[2];
    if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
    return { month, day };
  }
  const mdLabel = (md) => { const p = parseMD(md); return p ? `${p.month}月${p.day}日` : md; };
  const birthdayFlowers = (md) => (BIRTHDAYS[md] || []).map((id) => FLOWER_MAP[id]).filter(Boolean);
  function monthBirthdayFlowers(month) {
    const ids = [];
    for (let d = 1; d <= DAYS_IN_MONTH[month - 1]; d++) {
      (BIRTHDAYS[`${pad2(month)}-${pad2(d)}`] || []).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    }
    return FLOWERS.filter((f) => ids.includes(f.id));
  }
  const monthBloomFlowers = (month) => FLOWERS.filter((f) => f.bloomingMonths.includes(month));

  const SEASONS = [
    { label: '春', months: [3, 4, 5] }, { label: '夏', months: [6, 7, 8] },
    { label: '秋', months: [9, 10, 11] }, { label: '冬', months: [12, 1, 2] }
  ];
  const seasonsOf = (months) => SEASONS.filter((s) => s.months.some((m) => months.includes(m))).map((s) => s.label);

  // [1,2,3,10,11,12] → 「10〜3月」のように、年をまたぐ連続もまとめて表示
  function formatMonths(months) {
    const set = new Set(months);
    if (!set.size) return '';
    if (set.size === 12) return '通年';
    const next = (m) => (m % 12) + 1;
    const prev = (m) => ((m + 10) % 12) + 1;
    // 直前の月が含まれない月を起点にすると、年をまたぐ範囲も1つにまとまる
    const start = [...Array(12)].map((_, k) => k + 1).find((m) => set.has(m) && !set.has(prev(m)));
    const ranges = [];
    let run = null;
    for (let k = 0, m = start; k < 12; k++, m = next(m)) {
      if (set.has(m)) {
        if (run) run[1] = m; else run = [m, m];
      } else if (run) {
        ranges.push(run);
        run = null;
      }
    }
    if (run) ranges.push(run);
    return ranges.map(([a, b]) => (a === b ? `${a}月` : `${a}〜${b}月`)).join('、');
  }

  /* =========================================================
   * 花のイラスト（写真がないとき用の SVG）
   * ======================================================= */
  let uid = 0;
  function ring(n, fn) { let s = ''; for (let i = 0; i < n; i++) s += fn(i, (360 / n) * i); return s; }

  function flowerSVG(f) {
    const look = f.look || {};
    const [c0, c1, c2] = look.colors || ['#f7b6c8', '#e0748f', '#f2c94c'];
    const id = 'fg' + (++uid);
    const g = `url(#${id})`;
    const leaf = '#8fb58a';
    const leafDeep = '#6f9a6b';
    let body = '';

    switch (look.shape) {
      case 'daisy':
        body = ring(18, (i, a) => `<ellipse cx="60" cy="33" rx="6.5" ry="22" fill="${g}" transform="rotate(${a} 60 60)"/>`)
          + `<circle cx="60" cy="60" r="15" fill="${c2}"/><circle cx="60" cy="60" r="15" fill="url(#${id}d)" opacity=".5"/>`;
        break;
      case 'star':
        body = ring(6, (i, a) => `<path d="M60 60 C49 44 51 24 60 10 C69 24 71 44 60 60Z" fill="${g}" transform="rotate(${a} 60 60)"/>`)
          + ring(6, (i, a) => `<line x1="60" y1="60" x2="60" y2="44" stroke="${c2}" stroke-width="1.6" stroke-linecap="round" transform="rotate(${a + 30} 60 60)"/><circle cx="60" cy="43" r="2.2" fill="${c2}" transform="rotate(${a + 30} 60 60)"/>`)
          + `<circle cx="60" cy="60" r="4" fill="${c2}"/>`;
        break;
      case 'cup':
        body = `<path d="M60 110 C60 92 60 84 60 72" stroke="${leafDeep}" stroke-width="3" fill="none" stroke-linecap="round"/>`
          + `<path d="M60 104 C44 98 38 84 40 72 C50 80 56 90 60 100Z" fill="${leaf}"/>`
          + `<path d="M36 40 C34 62 44 76 60 76 C76 76 86 62 84 40 C76 46 68 48 60 40 C52 48 44 46 36 40Z" fill="${g}"/>`
          + `<path d="M48 34 C44 50 48 68 60 76 C72 68 76 50 72 34 C66 40 62 44 60 44 C58 44 54 40 48 34Z" fill="${c0}" opacity=".9"/>`
          + `<path d="M60 22 C52 34 52 60 60 76 C68 60 68 34 60 22Z" fill="${g}"/>`;
        break;
      case 'bell':
        body = `<path d="M30 30 C60 18 88 28 94 58" stroke="${leafDeep}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
          + `<path d="M24 108 C18 80 30 52 52 40 C44 64 44 86 50 108Z" fill="${leaf}" opacity=".85"/>`
          + [[40, 30], [56, 26], [72, 30], [86, 40], [92, 56]].map(([x, y], i) => {
            const r = 7 + (i % 2);
            return `<line x1="${x}" y1="${y - 3}" x2="${x}" y2="${y + 4}" stroke="${leafDeep}" stroke-width="1.4"/>`
              + `<path d="M${x - r} ${y + 16} C${x - r} ${y + 6} ${x - r * 0.6} ${y + 3} ${x} ${y + 3} C${x + r * 0.6} ${y + 3} ${x + r} ${y + 6} ${x + r} ${y + 16} C${x + r * 0.5} ${y + 13} ${x - r * 0.5} ${y + 13} ${x - r} ${y + 16}Z" fill="${g}" stroke="${c2}" stroke-opacity=".35" stroke-width=".8"/>`;
          }).join('');
        break;
      case 'cluster': {
        const pts = [[60, 40], [44, 48], [76, 48], [36, 64], [60, 60], [84, 64], [46, 78], [74, 78], [60, 88], [52, 52], [68, 70]];
        body = pts.map(([x, y], i) => {
          const col = i % 3 === 0 ? c1 : g;
          return `<g transform="translate(${x} ${y}) rotate(${i * 23})">`
            + ring(4, (k, a) => `<ellipse cx="0" cy="-5.5" rx="4.6" ry="6" fill="${col}" transform="rotate(${a})"/>`)
            + `<circle r="2" fill="${c2}"/></g>`;
        }).join('');
        break;
      }
      case 'layered':
        body = ring(8, (i, a) => `<ellipse cx="60" cy="34" rx="17" ry="24" fill="${c0}" transform="rotate(${a} 60 60)"/>`)
          + ring(6, (i, a) => `<ellipse cx="60" cy="42" rx="14" ry="19" fill="${g}" transform="rotate(${a + 20} 60 60)"/>`)
          + ring(5, (i, a) => `<ellipse cx="60" cy="50" rx="10" ry="13" fill="${c1}" opacity=".85" transform="rotate(${a + 10} 60 60)"/>`)
          + `<circle cx="60" cy="60" r="7" fill="${c2}" opacity=".9"/>`;
        break;
      case 'leaf':
        body = `<path d="M60 108 C60 90 60 76 60 64" stroke="${c2}" stroke-width="3" fill="none" stroke-linecap="round"/>`
          + ring(3, (i, a) => `<path d="M60 62 C44 50 38 30 50 22 C56 18 60 24 60 30 C60 24 64 18 70 22 C82 30 76 50 60 62Z" fill="${g}" transform="rotate(${a} 60 62)"/>`)
          + ring(3, (i, a) => `<path d="M60 60 L60 34" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.4" transform="rotate(${a} 60 62)"/>`);
        break;
      case 'spike':
        body = `<path d="M60 112 L60 30" stroke="${leafDeep}" stroke-width="3" stroke-linecap="round"/>`
          + `<path d="M60 108 C46 100 40 88 42 78 C52 84 58 94 60 104Z" fill="${leaf}"/>`
          + `<path d="M60 108 C74 100 80 88 78 78 C68 84 62 94 60 104Z" fill="${leaf}" opacity=".85"/>`
          + Array.from({ length: 9 }, (_, i) => {
            const y = 22 + i * 7.2;
            const w = 7 + Math.sin((i / 8) * Math.PI) * 6;
            return `<ellipse cx="${60 - w * 0.55}" cy="${y}" rx="${w * 0.55}" ry="4.4" fill="${i % 2 ? c1 : g}"/>`
              + `<ellipse cx="${60 + w * 0.55}" cy="${y + 3}" rx="${w * 0.55}" ry="4.4" fill="${i % 2 ? g : c1}"/>`;
          }).join('')
          + `<ellipse cx="60" cy="18" rx="4" ry="5" fill="${c2}"/>`;
        break;
      case 'trumpet':
        body = `<circle cx="60" cy="60" r="40" fill="${g}"/>`
          + ring(5, (i, a) => `<path d="M60 60 L60 21" stroke="#ffffff" stroke-opacity=".5" stroke-width="2" transform="rotate(${a} 60 60)"/>`)
          + `<circle cx="60" cy="60" r="16" fill="${c2}" opacity=".85"/><circle cx="60" cy="60" r="5" fill="${c1}" opacity=".6"/>`;
        break;
      default: // round
        body = ring(5, (i, a) => `<ellipse cx="60" cy="36" rx="19" ry="25" fill="${g}" transform="rotate(${a} 60 60)"/>`)
          + ring(5, (i, a) => `<path d="M60 58 L60 30" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.2" transform="rotate(${a} 60 60)"/>`)
          + `<circle cx="60" cy="60" r="11" fill="${c2}"/>`
          + ring(8, (i, a) => `<circle cx="60" cy="52" r="1.4" fill="#ffffff" opacity=".7" transform="rotate(${a} 60 60)"/>`);
    }

    return `<svg class="art-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">`
      + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`
      + `<radialGradient id="${id}d"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`
      + body + `</svg>`;
  }

  /* =========================================================
   * 写真（あれば表示、なければイラストのまま）
   * ======================================================= */
  const missingPhotos = new Set();
  try { JSON.parse(sessionStorage.getItem('hanakotoba.missing') || '[]').forEach((id) => missingPhotos.add(id)); } catch (e) { /* noop */ }

  function photoSrc(f) {
    if (f.image) return f.image.indexOf('/') >= 0 ? f.image : APP.photoDir + f.image;
    return `${APP.photoDir}${f.id}.${APP.photoExt}`;
  }

  function flowerArt(f, cls) {
    const [c0, c1] = (f.look && f.look.colors) || ['#f7b6c8', '#e0748f'];
    const photo = APP.usePhotos && !missingPhotos.has(f.id)
      ? `<img class="art-photo" src="${esc(photoSrc(f))}" alt="" loading="lazy" decoding="async" data-photo="${esc(f.id)}">`
      : '';
    return `<div class="art ${cls || ''}" style="--c0:${c0};--c1:${c1}">${flowerSVG(f)}${photo}</div>`;
  }

  // 画像の読み込み結果（error / load はバブリングしないのでキャプチャで受け取る）
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.photo) {
      missingPhotos.add(img.dataset.photo);
      try { sessionStorage.setItem('hanakotoba.missing', JSON.stringify(Array.from(missingPhotos))); } catch (err) { /* noop */ }
      img.remove();
    }
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.photo && img.parentNode) {
      img.parentNode.classList.add('has-photo');
    }
  }, true);

  /* =========================================================
   * アイコン（SVG）
   * ======================================================= */
  const ICONS = {
    back: '<path d="M15 5l-7 7 7 7" />',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    flower: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4C10 6 10.6 3.5 12 3.5s2 2.5 0 5.9zM14.6 12c3.4-2 5.9-1.4 5.9 0s-2.5 2-5.9 0zM12 14.6c2 3.4 1.4 5.9 0 5.9s-2-2.5 0-5.9zM9.4 12c-3.4 2-5.9 1.4-5.9 0s2.5-2 5.9 0z"/>',
    quote: '<path d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3v-3h-2A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M8 11h8M8 14h5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-4.5-5.5-2S10 9 12 9zm0 0c1.5-3.5 5.5-4.5 5.5-2S14 9 12 9z"/>',
    scene: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M12 13.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 15.3l2-.3z"/>',
    kana: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><text x="12" y="16.6" text-anchor="middle" font-size="11" font-weight="600" stroke="none" fill="currentColor" font-family="Hiragino Sans, sans-serif">あ</text>',
    star: '<path d="M12 3.8l2.4 5 5.4.7-4 3.8 1 5.4L12 16.1l-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
    shuffle: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/>',
    share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6.5 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-.5"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.6.5 1 1.2 1 2V15h4.6v-.1c0-.8.4-1.5 1-2A5.5 5.5 0 0 0 12 3.5z"/>',
    cake: '<path d="M4.5 20.5h15M5.5 20.5v-7a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v7"/><path d="M5.5 15.5c1.2 0 1.6-1 3.2-1s1.6 1 3.3 1 1.7-1 3.3-1 1.9 1 3.2 1M12 12V9"/><path d="M12 4.2c.9 1 1.3 1.8 1.3 2.5a1.3 1.3 0 0 1-2.6 0c0-.7.4-1.5 1.3-2.5z"/>',
    grid: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 13.5h1.5M11.25 13.5h1.5M14.5 13.5H16M8 16.8h1.5M11.25 16.8h1.5"/>',
    tulip: '<path d="M12 21v-8.5"/><path d="M12 12.5c-3.6 0-5.5-2.6-5.5-6.3 1.6.6 2.8 1.6 3.5 2.8.4-2 1.1-3.6 2-4.8.9 1.2 1.6 2.8 2 4.8.7-1.2 1.9-2.2 3.5-2.8 0 3.7-1.9 6.3-5.5 6.3z"/><path d="M12 18c-1.7-1.9-3.8-2.5-5.5-2.2.5 2.2 2.6 3.6 5.5 3.7M12 17.4c1.5-1.5 3.3-2 4.8-1.7-.4 1.9-2.2 3.1-4.8 3.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.6 0-1.2-1-1.4-1-2.5 0-.9.7-1.4 1.6-1.4h2.1a4 4 0 0 0 4-4c0-4.2-3.8-7.5-8.5-7.5z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.4" r="1.1" fill="currentColor"/><circle cx="15" cy="7.8" r="1.1" fill="currentColor"/>'
  };
  const icon = (name, cls) => `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  /* =========================================================
   * 部品
   * ======================================================= */
  function favButton(f, extraCls) {
    const on = Favorites.has(f.id);
    return `<button type="button" class="fav-btn ${extraCls || ''} ${on ? 'is-on' : ''}" data-fav="${esc(f.id)}" aria-pressed="${on}" aria-label="${esc(f.name)}を${on ? 'お気に入りから外す' : 'お気に入りに追加'}">`
      + `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS.heart}</svg>`
      + `<span class="fav-label">${on ? '♥' : '♡'}</span></button>`;
  }

  function flowerCard(f, opts) {
    const o = opts || {};
    const meanings = o.highlight ? highlightMeanings(f, o.highlight) : esc(quote(f.meanings.slice(0, 2)));
    return `<li class="card-item"><article class="flower-card">`
      + `<a class="flower-card-link" href="#/flower/${esc(f.id)}" aria-label="${esc(f.name)}（${esc(f.kana)}）：花言葉 ${esc(f.meanings.slice(0, 2).join('、'))}">`
      + flowerArt(f, 'art-card')
      + `<div class="flower-card-body">`
      + `<h3 class="flower-name">${esc(f.name)}</h3>`
      + `<p class="flower-kana">${esc(f.kana)}</p>`
      + `<p class="flower-meanings">${meanings}</p>`
      + (o.reason && f.point ? `<p class="flower-reason">${esc(f.point)}</p>` : '')
      + `</div></a>`
      + favButton(f, 'fav-on-card')
      + `</article></li>`;
  }

  function highlightMeanings(f, q) {
    const terms = queryTerms(q);
    const hits = f._allMeanings.filter((m) => terms.every((t) => norm(m).includes(t)));
    const list = hits.length ? hits : f._allMeanings.filter((m) => terms.some((t) => norm(m).includes(t)));
    const shown = (list.length ? list : f.meanings).slice(0, 3);
    return shown.map((m) => `<mark>「${esc(m)}」</mark>`).join('');
  }

  function cardGrid(list, opts) {
    if (!list.length) return emptyState(opts && opts.emptyText);
    return `<ul class="card-grid" role="list">${list.map((f) => flowerCard(f, opts)).join('')}</ul>`;
  }

  function emptyState(text) {
    return `<div class="empty" role="status">`
      + `<div class="empty-art" aria-hidden="true">${flowerSVG({ look: { shape: 'cup', colors: ['#fbd3df', '#f2a2b9', '#8fb58a'] } })}</div>`
      + `<p class="empty-title">${esc(text || 'その条件に合う花が見つかりませんでした')}</p>`
      + `<p class="empty-sub">別の言葉でも探してみてください 🌷<br>「感謝」「希望」「友情」などの短い言葉がおすすめです。</p>`
      + `</div>`;
  }

  function searchBox(key, placeholder, value, label) {
    return `<div class="search-box" role="search">`
      + `<label class="visually-hidden" for="search-${key}">${esc(label || placeholder)}</label>`
      + icon('search', 'search-icon')
      + `<input id="search-${key}" class="search-input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-search="${key}" placeholder="${esc(placeholder)}" value="${esc(value || '')}">`
      + `<button type="button" class="search-clear" data-clear="${key}" aria-label="検索語を消す" ${value ? '' : 'hidden'}>${icon('close')}</button>`
      + `</div>`;
  }

  function pageHead(title, lead) {
    return `<header class="page-head"><h1 class="page-title" tabindex="-1">${esc(title)}</h1>${lead ? `<p class="page-lead">${esc(lead)}</p>` : ''}</header>`;
  }

  function tileGrid(items, base, cls) {
    return `<ul class="tile-grid ${cls || ''}" role="list">` + items.map((it) => {
      const n = FLOWERS.filter((f) => f[base.field].includes(it.id)).length;
      return `<li><a class="tile" href="#/${base.route}/${it.id}">`
        + `<span class="tile-emoji" aria-hidden="true">${it.emoji}</span>`
        + `<span class="tile-text"><span class="tile-label">${esc(it.label)}</span><span class="tile-count">${n}種類</span></span>`
        + icon('chevron', 'tile-chevron')
        + `</a></li>`;
    }).join('') + `</ul>`;
  }

  function footer() {
    return `<footer class="app-footer">`
      + `<p class="footer-note">花言葉や誕生花には諸説があります。</p>`
      + `<p class="footer-ref">情報整理の参考：<a href="${APP.referenceUrl}" target="_blank" rel="noopener noreferrer">AND PLANTS 花言葉一覧</a>／<a href="${APP.birthdayReferenceUrl}" target="_blank" rel="noopener noreferrer">花言葉-由来 誕生花カレンダー</a></p>`
      + `<p class="footer-small">本アプリは個人制作の非公式アプリで、参考サイトの運営者とは関係ありません。掲載文章はオリジナルです。</p>`
      + `<p class="footer-version">${APP.name} ${APP.versionLabel}</p>`
      + `</footer>`;
  }

  /* =========================================================
   * 画面
   * ======================================================= */
  const state = { queries: { home: '', flowers: '', meanings: '' }, monthTab: 'bloom' };

  const MENU = [
    { href: '#/flowers', icon: 'flower', label: '花から探す', sub: '名前で一覧', tone: 'rose' },
    { href: '#/meanings', icon: 'quote', label: '花言葉から探す', sub: '感謝・希望…', tone: 'peach' },
    { href: '#/feelings', icon: 'heart', label: '気持ちから探す', sub: '伝えたい想い', tone: 'pink' },
    { href: '#/recipients', icon: 'gift', label: '贈る相手から探す', sub: '家族・友人…', tone: 'lav' },
    { href: '#/scenes', icon: 'scene', label: 'シーンから探す', sub: '誕生日・卒業…', tone: 'sky' },
    { href: '#/kana', icon: 'kana', label: '五十音から探す', sub: 'あ〜わ行', tone: 'mint' },
    { href: '#/birthday', icon: 'cake', label: '誕生日から探す', sub: '月と日を選ぶ', tone: 'peach' },
    { href: '#/calendar', icon: 'grid', label: '誕生花カレンダー', sub: '366日の誕生花', tone: 'pink' },
    { href: '#/months', icon: 'tulip', label: '月から探す', sub: '咲く花・誕生花', tone: 'mint' },
    { href: '#/favorites', icon: 'star', label: 'お気に入り', sub: '保存した花', tone: 'rose' },
    { href: '#random', icon: 'shuffle', label: 'ランダムな花', sub: '今日の出会い', tone: 'gold', random: true },
    { href: '#/about', icon: 'info', label: 'このアプリについて', sub: '収録数・注意書き', tone: 'lav' }
  ];

  // 誕生花・月の画面で使う部品
  const MONTHS = [...Array(12)].map((_, i) => i + 1);
  function monthNav(route, active, label) {
    return `<nav class="month-nav" aria-label="${esc(label || '月を選ぶ')}"><ul role="list">`
      + MONTHS.map((m) => `<li><a class="month-btn ${m === active ? 'is-active' : ''}" href="#/${route}/${pad2(m)}" data-replace="1" ${m === active ? 'aria-current="page"' : ''}>${m}月</a></li>`).join('')
      + `</ul></nav>`;
  }
  function miniFlowerList(list) {
    return `<ul class="mini-list" role="list">` + list.map((f) => `<li><a class="mini-flower" href="#/flower/${esc(f.id)}">`
      + flowerArt(f, 'art-mini')
      + `<span class="mini-text"><span class="mini-name">${esc(f.name)}</span><span class="mini-meaning">${esc(quote(f.meanings.slice(0, 1)))}</span></span></a></li>`).join('')
      + `</ul>`;
  }
  const birthdayNote = `<p class="soft-note">誕生花は資料によって異なり、諸説があります。</p>`;

  const Views = {
    home() {
      const today = new Date();
      const tf = todaysFlower(today);
      const q = state.queries.home;
      return {
        title: APP.name,
        isHome: true,
        html: `<section class="hero">`
          + `<h1 class="hero-title" tabindex="-1"><span class="hero-mark" aria-hidden="true">🌸</span> ${APP.name}</h1>`
          + `<p class="hero-sub">${APP.subtitle}</p>`
          + searchBox('home', '花の名前・花言葉から検索', q, '花の名前・花言葉・気持ちから検索')
          + `<div class="hero-chips" aria-label="検索のヒント">`
          + ['バラ', 'ひまわり', '感謝', '希望', '友情'].map((w) => `<button type="button" class="chip chip-soft" data-q="home" data-word="${w}">${w}</button>`).join('')
          + `</div></section>`
          + `<div id="home-results" class="search-results" aria-live="polite" ${q ? '' : 'hidden'}>${q ? homeResults(q) : ''}</div>`
          + `<div id="home-main" ${q ? 'hidden' : ''}>`
          + `<section class="today" aria-labelledby="today-title" data-today="${dateKey(today)}">`
          + `<a class="today-card" href="#/flower/${tf.id}">`
          + `<div class="today-text">`
          + `<p class="today-label" id="today-title">${icon('calendar')}今日の花<span class="today-date">${dateLabel(today)}</span></p>`
          + `<h2 class="today-name">${esc(tf.name)}</h2>`
          + `<p class="today-meanings">${esc(quote(tf.meanings.slice(0, 2)))}</p>`
          + `<p class="today-message">${esc(tf.message)}</p>`
          + `<span class="btn btn-primary btn-small today-more">詳しく見る${icon('chevron')}</span>`
          + `</div>`
          + flowerArt(tf, 'art-today')
          + `</a></section>`
          + todayBirthday(today)
          + `<section aria-labelledby="menu-title"><h2 class="section-title" id="menu-title">花をさがす</h2>`
          + `<ul class="menu-grid" role="list">`
          + MENU.map((m) => `<li><a class="menu-card tone-${m.tone}" href="${m.href}" ${m.random ? 'data-random="1"' : ''}>`
            + `<span class="menu-icon">${icon(m.icon)}</span>`
            + `<span class="menu-label">${m.label}</span><span class="menu-sub">${m.sub}</span></a></li>`).join('')
          + `</ul></section>`
          + `<p class="home-count">いま <strong>${FLOWERS.length}</strong> 種類の花を収録しています</p>`
          + `</div>`
      };
    },

    birthday(mm) {
      const month = +mm || 0;
      const valid = month >= 1 && month <= 12;
      return {
        title: '誕生日から探す',
        html: pageHead('誕生日から探す', '生まれた月と日を選ぶと、その日の誕生花がわかります。')
          + `<h2 class="step-title"><span class="step-no">1</span>月を選ぶ</h2>`
          + monthNav('birthday', valid ? month : 0, '誕生日の月')
          + (valid
            ? `<h2 class="step-title"><span class="step-no">2</span>${month}月の何日？</h2>`
              + `<ul class="day-grid" role="list">`
              + [...Array(DAYS_IN_MONTH[month - 1])].map((_, i) => {
                const md = `${pad2(month)}-${pad2(i + 1)}`;
                return `<li><a class="day-btn" href="#/date/${md}" aria-label="${month}月${i + 1}日の誕生花">${i + 1}</a></li>`;
              }).join('')
              + `</ul>`
              + (month === 2 ? `<p class="soft-note">2月29日生まれの方の誕生花も調べられます。</p>` : '')
            : `<p class="hint">上から生まれた月を選んでください。</p>`)
          + birthdayNote
      };
    },

    calendar(mm) {
      const now = new Date();
      const month = (+mm >= 1 && +mm <= 12) ? +mm : now.getMonth() + 1;
      const todayMD = mdOf(now);
      let cells = '';
      for (let d = 1; d <= DAYS_IN_MONTH[month - 1]; d++) {
        const md = `${pad2(month)}-${pad2(d)}`;
        const list = birthdayFlowers(md);
        const names = list.slice(0, 2).map((f) => `<span class="cal-name">${esc(f.name)}</span>`).join('');
        cells += `<li><a class="cal-cell ${md === todayMD ? 'is-today' : ''}" href="#/date/${md}" aria-label="${month}月${d}日の誕生花：${esc(list.map((f) => f.name).join('、'))}">`
          + `<span class="cal-day">${d}${md === todayMD ? '<span class="cal-today">今日</span>' : ''}</span>${names}`
          + (list.length > 2 ? `<span class="cal-more">ほか${list.length - 2}種</span>` : '')
          + `</a></li>`;
      }
      return {
        title: '誕生花カレンダー',
        html: pageHead('誕生花カレンダー', '1年366日の誕生花を月ごとに見られます。日付をタップすると詳しく表示します。')
          + monthNav('calendar', month, '表示する月')
          + `<h2 class="section-title cal-title">${month}月の誕生花</h2>`
          + `<ul class="cal-grid" role="list">${cells}</ul>`
          + birthdayNote
      };
    },

    date(md) {
      const p = parseMD(md);
      if (!p) return Views.notFound();
      const list = birthdayFlowers(md);
      const prevMD = (() => { let m = p.month; let d = p.day - 1; if (d < 1) { m = m === 1 ? 12 : m - 1; d = DAYS_IN_MONTH[m - 1]; } return `${pad2(m)}-${pad2(d)}`; })();
      const nextMD = (() => { let m = p.month; let d = p.day + 1; if (d > DAYS_IN_MONTH[m - 1]) { m = m === 12 ? 1 : m + 1; d = 1; } return `${pad2(m)}-${pad2(d)}`; })();
      return {
        title: `${p.month}月${p.day}日の誕生花`,
        html: pageHead(`${p.month}月${p.day}日の誕生花`, list.length > 1 ? `この日の誕生花は${list.length}種類あります。` : '')
          + `<nav class="day-pager" aria-label="前後の日">`
          + `<a class="btn btn-ghost btn-small" href="#/date/${prevMD}" data-replace="1" aria-label="前の日（${mdLabel(prevMD)}）">${icon('back')}${mdLabel(prevMD)}</a>`
          + `<a class="btn btn-ghost btn-small" href="#/date/${nextMD}" data-replace="1" aria-label="次の日（${mdLabel(nextMD)}）">${mdLabel(nextMD)}${icon('chevron')}</a>`
          + `</nav>`
          + cardGrid(list, { emptyText: 'この日の誕生花はまだ登録されていません' })
          + `<p class="center"><a class="btn btn-ghost btn-small" href="#/calendar/${pad2(p.month)}">${p.month}月のカレンダーを見る</a></p>`
          + birthdayNote
      };
    },

    months(mm) {
      const month = +mm;
      if (!mm) {
        return {
          title: '月から探す',
          html: pageHead('月から探す', '月を選ぶと、その月に咲く花と、その月の誕生花を見られます。')
            + `<ul class="month-grid" role="list">`
            + MONTHS.map((m) => `<li><a class="month-tile" href="#/months/${pad2(m)}">`
              + `<span class="month-num">${m}<small>月</small></span>`
              + `<span class="month-meta">咲く花 ${monthBloomFlowers(m).length}種<br>誕生花 ${monthBirthdayFlowers(m).length}種</span></a></li>`).join('')
            + `</ul>`
        };
      }
      if (!(month >= 1 && month <= 12)) return Views.notFound();
      return {
        title: `${month}月の花`,
        html: pageHead(`${month}月の花`, '')
          + monthNav('months', month, '表示する月')
          + `<div class="seg" role="tablist" aria-label="表示の切り替え">`
          + `<button type="button" class="seg-btn" role="tab" id="tab-bloom" aria-controls="month-panel" aria-selected="${state.monthTab !== 'birth'}" data-month-tab="bloom">${month}月に咲く花 <span class="seg-count">${monthBloomFlowers(month).length}</span></button>`
          + `<button type="button" class="seg-btn" role="tab" id="tab-birth" aria-controls="month-panel" aria-selected="${state.monthTab === 'birth'}" data-month-tab="birth">${month}月の誕生花 <span class="seg-count">${monthBirthdayFlowers(month).length}</span></button>`
          + `</div>`
          + `<div id="month-panel" role="tabpanel" data-month="${month}">${monthPanel(month)}</div>`
      };
    },

    about() {
      const withBirth = FLOWERS.filter((f) => f.birthDates.length).length;
      const days = Object.keys(BIRTHDAYS).length;
      return {
        title: 'このアプリについて',
        html: pageHead('このアプリについて', APP.subtitle)
          + `<ul class="stat-grid" role="list">`
          + `<li class="stat"><span class="stat-num">${FLOWERS.length}</span><span class="stat-label">種類の花を収録</span></li>`
          + `<li class="stat"><span class="stat-num">${days}</span><span class="stat-label">日分の誕生花</span></li>`
          + `<li class="stat"><span class="stat-num">${withBirth}</span><span class="stat-label">種類が誕生花に登場</span></li>`
          + `</ul>`
          + `<section class="panel"><h2 class="panel-title">${icon('info')}ご利用にあたって</h2>`
          + `<p>花言葉や誕生花は、国や時代、資料によって異なり、諸説があります。本アプリでは広く紹介されている代表的なものを掲載しています。</p>`
          + `<p class="panel-p">お気に入りはこの端末のブラウザ内にだけ保存されます。</p></section>`
          + `<section class="panel"><h2 class="panel-title">${icon('book')}参考にした情報</h2>`
          + `<p>花言葉の整理には <a href="${APP.referenceUrl}" target="_blank" rel="noopener noreferrer">AND PLANTS 花言葉一覧</a>、誕生花の日付には <a href="${APP.birthdayReferenceUrl}" target="_blank" rel="noopener noreferrer">花言葉-由来 誕生花カレンダー</a> などを参考にしました。</p>`
          + `<p class="panel-p">本アプリは個人制作の非公式アプリで、各サイトの運営者とは関係ありません。解説文はオリジナルで、画像の転載は行っていません。</p></section>`
          + `<p class="center soft-note">${APP.name} ${APP.versionLabel}</p>`
      };
    },

    flowers() {
      const q = state.queries.flowers;
      return {
        title: '花から探す',
        html: pageHead('花から探す', `${FLOWERS.length}種類の花を五十音順に並べています。`)
          + searchBox('flowers', '花の名前・読み方で絞り込み', q)
          + `<div id="flowers-results" aria-live="polite">${flowersResults(q)}</div>`
      };
    },

    meanings() {
      const q = state.queries.meanings;
      const words = ['感謝', '希望', '友情', '愛', '幸福', '尊敬', '誠実', '思い出', '勇気', '純粋', '未来', '優しさ'];
      const all = Array.from(new Set(FLOWERS.flatMap((f) => f._allMeanings))).sort(collator.compare);
      return {
        title: '花言葉から探す',
        html: pageHead('花言葉から探す', '伝えたい言葉を入力すると、その花言葉をもつ花が見つかります。')
          + searchBox('meanings', '例：感謝、希望、友情', q, '花言葉で検索')
          + `<div class="chip-row" aria-label="よく探される花言葉">`
          + words.map((w) => `<button type="button" class="chip" data-q="meanings" data-word="${w}">${w}</button>`).join('')
          + `</div>`
          + `<div id="meanings-results" aria-live="polite">${meaningsResults(q)}</div>`
          + `<details class="all-words"><summary>すべての花言葉から選ぶ（${all.length}語）</summary>`
          + `<div class="chip-cloud">${all.map((w) => `<button type="button" class="chip chip-small" data-q="meanings" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>`
          + `</details>`
      };
    },

    feelings(id) {
      if (id) {
        const c = feelingMap[id];
        if (!c) return Views.notFound();
        const list = FLOWERS.filter((f) => f.categories.includes(id));
        return {
          title: c.label,
          html: pageHead(`${c.emoji} ${c.label}`, c.desc) + `<p class="result-count">${list.length}種類の花</p>` + cardGrid(list, { reason: true })
        };
      }
      return {
        title: '気持ちから探す',
        html: pageHead('気持ちから探す', '伝えたい気持ちを選ぶと、その想いに合う花が見つかります。')
          + tileGrid(TAX.feelings, { route: 'feelings', field: 'categories' })
      };
    },

    recipients(id) {
      if (id) {
        const c = recipientMap[id];
        if (!c) return Views.notFound();
        const list = FLOWERS.filter((f) => f.recipients.includes(id));
        return {
          title: c.label,
          html: pageHead(`${c.emoji} ${c.label}へ`, c.desc) + `<p class="result-count">${list.length}種類の花・カードにおすすめの理由を表示しています</p>` + cardGrid(list, { reason: true })
        };
      }
      return {
        title: '贈る相手から探す',
        html: pageHead('贈る相手から探す', '誰に贈るかを選ぶと、その人にぴったりの花をご提案します。')
          + tileGrid(TAX.recipients, { route: 'recipients', field: 'recipients' })
      };
    },

    scenes(id) {
      if (id) {
        const c = sceneMap[id];
        if (!c) return Views.notFound();
        const list = FLOWERS.filter((f) => f.scenes.includes(id));
        return {
          title: c.label,
          html: pageHead(`${c.emoji} ${c.label}`, c.desc) + `<p class="result-count">${list.length}種類の花</p>` + cardGrid(list, { reason: true })
        };
      }
      return {
        title: 'シーンから探す',
        html: pageHead('シーンから探す', '贈るシーンを選ぶと、おすすめの花が見つかります。')
          + tileGrid(TAX.scenes, { route: 'scenes', field: 'scenes' })
      };
    },

    kana(rowId) {
      const row = kanaRowMap[rowId] || TAX.kanaRows[0];
      const list = FLOWERS.filter((f) => f._row === row.id);
      let groups = '';
      for (const ch of row.chars) {
        const g = list.filter((f) => f._head === ch);
        if (!g.length) continue;
        groups += `<section class="kana-group" aria-labelledby="kana-${ch}"><h2 class="kana-head" id="kana-${ch}">${ch}</h2>${cardGrid(g)}</section>`;
      }
      return {
        title: '五十音から探す',
        html: pageHead('五十音から探す', '行を選ぶと、その行の花を読み順に表示します。')
          + `<nav class="kana-nav" aria-label="五十音の行"><ul role="list">`
          + TAX.kanaRows.map((r) => {
            const n = FLOWERS.filter((f) => f._row === r.id).length;
            return `<li><a class="kana-btn ${r.id === row.id ? 'is-active' : ''}" href="#/kana/${r.id}" ${r.id === row.id ? 'aria-current="page"' : ''} aria-label="${r.label}行（${n}種類）" data-replace="1">${r.label}</a></li>`;
          }).join('')
          + `</ul></nav>`
          + `<p class="result-count">${row.label}行：${list.length}種類</p>`
          + (groups || emptyState(`${row.label}行の花はまだ登録されていません`))
      };
    },

    favorites() {
      const list = Favorites.list();
      return {
        title: 'お気に入り',
        html: pageHead('お気に入り', 'ハートを押した花がここに集まります。この端末のブラウザに保存されます。')
          + (list.length
            ? `<p class="result-count">${list.length}種類の花</p>` + cardGrid(list)
            : `<div class="empty" role="status"><div class="empty-art" aria-hidden="true">${flowerSVG({ look: { shape: 'round', colors: ['#fbd3df', '#f2a2b9', '#f5d55c'] } })}</div>`
              + `<p class="empty-title">お気に入りはまだありません</p>`
              + `<p class="empty-sub">気になる花の ♡ をタップすると、ここに保存されます 🌷</p>`
              + `<a class="btn btn-primary" href="#/flowers">花を見に行く</a></div>`)
      };
    },

    flower(id) {
      const f = FLOWER_MAP[id];
      if (!f) return Views.notFound();
      const tagLinks = (ids, map, route) => ids.filter((x) => map[x]).map((x) => `<a class="tag" href="#/${route}/${x}">${esc(map[x].label)}</a>`).join('');
      const recommend = tagLinks(f.recipients, recipientMap, 'recipients') + tagLinks(f.scenes, sceneMap, 'scenes');
      // 情報がある項目だけを表示する
      const panel = (key, ic, title, body, cls) => (body ? `<section class="panel ${cls || ''}" aria-labelledby="d-${key}"><h2 class="panel-title" id="d-${key}">${icon(ic)}${title}</h2>${body}</section>` : '');
      const bloom = f.season || formatMonths(f.bloomingMonths);
      const seasons = seasonsOf(f.bloomingMonths);
      const birth = f.birthDates.map((md) => `<a class="tag tag-date" href="#/date/${md}">${mdLabel(md)}</a>`).join('');
      return {
        title: f.name,
        html: `<article class="detail">`
          + `<div class="detail-hero">${flowerArt(f, 'art-detail')}${favButton(f, 'fav-on-hero')}</div>`
          + `<header class="detail-head">`
          + `<p class="detail-kana">${esc(f.kana)}</p>`
          + `<h1 class="detail-name" tabindex="-1">${esc(f.name)}</h1>`
          + (f.aliases.length ? `<p class="detail-alias"><span class="visually-hidden">別名：</span>${f.aliases.map(esc).join('・')}</p>` : '')
          + (f.description ? `<p class="detail-desc">${esc(f.description)}</p>` : '')
          + `</header>`
          + `<section class="panel panel-meanings" aria-labelledby="d-meanings"><h2 class="panel-title" id="d-meanings">${icon('quote')}代表的な花言葉</h2>`
          + `<ul class="meaning-list" role="list">${f.meanings.map((m) => `<li>「${esc(m)}」</li>`).join('')}</ul></section>`
          + (f.colorMeanings.length ? `<section class="panel" aria-labelledby="d-colors"><h2 class="panel-title" id="d-colors">${icon('palette')}色別の花言葉</h2>`
            + `<ul class="color-list" role="list">` + f.colorMeanings.map((c) => `<li class="color-row">`
              + `<span class="color-dot" style="background:${esc(c.hex)}" aria-hidden="true"></span>`
              + `<span class="color-name">${esc(c.color)}</span>`
              + `<span class="color-words">${esc(quote(c.meanings))}${c.note ? `<small class="color-note">※${esc(c.note)}</small>` : ''}</span></li>`).join('')
            + `</ul></section>` : '')
          + panel('origin', 'book', '花言葉の由来', f.origin ? `<p>${esc(f.origin)}</p>` : '')
          + panel('birth', 'cake', '誕生花', birth ? `<div class="tag-list">${birth}</div>` : '')
          + panel('rec', 'gift', 'こんな人・場面におすすめ', recommend ? `<div class="tag-list">${recommend}</div>` : '')
          + panel('season', 'leaf', '開花時期', bloom ? `<p>${esc(bloom)}</p>` + (seasons.length ? `<p class="season-tags">${seasons.map((x) => `<span class="season-tag">${x}</span>`).join('')}</p>` : '') : '')
          + panel('alias', 'flower', '別名', f.aliases.length ? `<p>${f.aliases.map(esc).join('、')}</p>` : '')
          + panel('trivia', 'bulb', '豆知識', f.trivia ? `<p>${esc(f.trivia)}</p>` : '')
          + (f.categories.length ? `<section class="panel" aria-labelledby="d-feel"><h2 class="panel-title" id="d-feel">${icon('heart')}こんな気持ちに</h2><div class="tag-list">${tagLinks(f.categories, feelingMap, 'feelings')}</div></section>` : '')
          + `<div class="detail-actions">`
          + `<button type="button" class="btn btn-primary btn-block" data-share="${esc(f.id)}">${icon('share')}この花言葉をシェア</button>`
          + `<button type="button" class="btn btn-ghost btn-block" data-random="1">${icon('shuffle')}ほかの花にランダムで出会う</button>`
          + `</div>`
          + `<p class="detail-note">花言葉や誕生花には諸説あります。ここでは広く紹介されている代表的なものを掲載しています。</p>`
          + `</article>`
      };
    },

    notFound() {
      return {
        title: 'ページが見つかりません',
        html: pageHead('ページが見つかりません') + emptyState('お探しのページは見つかりませんでした')
          + `<p class="center"><a class="btn btn-primary" href="#/">ホームへ戻る</a></p>`
      };
    }
  };

  function todayBirthday(now) {
    const md = mdOf(now);
    const list = birthdayFlowers(md);
    if (!list.length) return '';
    return `<section class="birth-today" aria-labelledby="birth-title" data-today="${dateKey(now)}">`
      + `<div class="birth-head"><p class="today-label" id="birth-title">${icon('cake')}今日の誕生花<span class="today-date">${mdLabel(md)}</span></p>`
      + `<a class="birth-more" href="#/date/${md}">すべて見る${icon('chevron')}</a></div>`
      + miniFlowerList(list)
      + `</section>`;
  }

  function monthPanel(month) {
    const tab = state.monthTab === 'birth' ? 'birth' : 'bloom';
    if (tab === 'birth') {
      const list = monthBirthdayFlowers(month);
      return `<p class="result-count">${month}月のいずれかの日の誕生花になっている花です（${list.length}種類）。日付は各花の詳細で見られます。</p>`
        + cardGrid(list) + birthdayNote;
    }
    const list = monthBloomFlowers(month);
    return `<p class="result-count">${month}月ごろに花が見られる花です（${list.length}種類）。開花時期は地域や品種によって前後します。</p>`
      + cardGrid(list);
  }

  function homeResults(q) {
    const list = search(q, 'all');
    return `<p class="result-count">「${esc(q)}」の検索結果：${list.length}件</p>` + cardGrid(list);
  }
  function flowersResults(q) {
    const list = q ? search(q, 'all') : FLOWERS;
    return (q ? `<p class="result-count">${list.length}件</p>` : '') + cardGrid(list);
  }
  function meaningsResults(q) {
    if (!q) return `<p class="hint">上のキーワードをタップするか、言葉を入力してください。「ありがとう」なら「感謝」、「がんばって」なら「勇気」「希望」がおすすめです。</p>`;
    const list = search(q, 'meaning');
    return `<p class="result-count">花言葉に「${esc(q)}」を含む花：${list.length}件</p>` + cardGrid(list, { highlight: q });
  }
  const RESULTS = {
    home: { el: 'home-results', fn: homeResults },
    flowers: { el: 'flowers-results', fn: flowersResults },
    meanings: { el: 'meanings-results', fn: meaningsResults }
  };

  /* =========================================================
   * ルーター（ハッシュ方式：GitHub Pages でもリロードで壊れない）
   * ======================================================= */
  const viewEl = document.getElementById('view');
  const topbar = document.getElementById('topbar');
  const topTitle = document.getElementById('topbar-title');
  const backBtn = document.getElementById('back-btn');

  const navStack = [];
  const scrollMemory = {};
  let currentHash = null;

  function parseHash(h) {
    const path = (h || '').replace(/^#\/?/, '').split('?')[0];
    const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { name: parts[0] || 'home', param: parts[1] || '' };
  }
  function canonical(h) {
    const r = parseHash(h);
    return r.name === 'home' ? '#/' : `#/${r.name}${r.param ? '/' + r.param : ''}`;
  }
  function parentOf(r) {
    if (r.param && ['feelings', 'recipients', 'scenes', 'months'].includes(r.name)) return `#/${r.name}`;
    if (r.name === 'date') { const p = parseMD(r.param); return p ? `#/calendar/${pad2(p.month)}` : '#/calendar'; }
    return '#/';
  }


  function randomFlowerId(excludeId) {
    if (FLOWERS.length < 2) return FLOWERS[0] && FLOWERS[0].id;
    let f;
    do { f = FLOWERS[Math.floor(Math.random() * FLOWERS.length)]; } while (f.id === excludeId);
    return f.id;
  }

  function render(isBack) {
    const hash = canonical(location.hash);
    const r = parseHash(hash);
    const fn = Views[r.name];
    const v = fn ? fn(r.param) : Views.notFound();

    currentHash = hash;
    document.body.classList.toggle('is-home', !!v.isHome);
    topbar.hidden = !!v.isHome;
    topTitle.textContent = v.title;
    document.title = v.isHome ? `${APP.name}｜${APP.subtitle}` : `${v.title}｜${APP.name}`;

    viewEl.innerHTML = `<div class="view-inner">${v.html}</div>` + footer();
    viewEl.classList.remove('view-enter');
    void viewEl.offsetWidth; // アニメーションを再生
    viewEl.classList.add('view-enter');

    const y = isBack ? (scrollMemory[hash] || 0) : 0;
    window.scrollTo(0, y);

    // 画面の見出しへフォーカスを移し、読み上げ環境でも迷子にならないようにする
    if (!v.isHome && !isBack) {
      const h = viewEl.querySelector('[tabindex="-1"]');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function onHashChange() {
    const hash = canonical(location.hash);
    if (hash === currentHash) return;
    if (currentHash) scrollMemory[currentHash] = window.scrollY;
    let isBack = false;
    if (navStack.length > 1 && navStack[navStack.length - 2] === hash) {
      navStack.pop();
      isBack = true;
    } else if (replaceNext && navStack.length) {
      navStack[navStack.length - 1] = hash;
    } else {
      navStack.push(hash);
    }
    replaceNext = false;
    render(isBack);
  }

  let replaceNext = false;
  function go(hash, replace) {
    if (replace) {
      replaceNext = true;
      location.replace(hash);
    } else {
      location.hash = hash;
    }
  }

  function goBack() {
    if (navStack.length > 1) {
      history.back();
    } else {
      const target = parentOf(parseHash(currentHash));
      navStack.length = 0;
      navStack.push(target);
      replaceNext = true;
      location.replace(target);
    }
  }

  /* =========================================================
   * シェア
   * ======================================================= */
  async function shareFlower(f) {
    const text = `${f.emoji || '🌸'} ${f.name}\n花言葉${quote(f.meanings.slice(0, 3))}\n\n花言葉アプリで見つけました。`;
    const url = location.href.split('#')[0] + '#/flower/' + f.id;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${f.name}の花言葉`, text, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // ユーザーがキャンセル
      }
    }
    const full = `${text}\n${url}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(full);
      } else {
        legacyCopy(full);
      }
      toast('花言葉をコピーしました。メッセージに貼り付けて送れます 🌷');
    } catch (e) {
      try { legacyCopy(full); toast('花言葉をコピーしました 🌷'); } catch (err) { toast('コピーできませんでした。お手数ですが手動でコピーしてください。'); }
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  /* =========================================================
   * イベント（委譲）
   * ======================================================= */
  function updateResults(key) {
    const conf = RESULTS[key];
    const q = state.queries[key];
    const box = document.getElementById(conf.el);
    if (box) box.innerHTML = conf.fn(q);
    if (key === 'home') {
      const main = document.getElementById('home-main');
      if (box) box.hidden = !q;
      if (main) main.hidden = !!q;
    }
    const clear = viewEl.querySelector(`[data-clear="${key}"]`);
    if (clear) clear.hidden = !q;
  }

  viewEl.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.search;
    if (!key) return;
    state.queries[key] = e.target.value.trim();
    updateResults(key);
  });

  viewEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.search) {
      e.preventDefault();
      e.target.blur(); // iPhone のキーボードを閉じて結果を見やすく
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;

    if (t.dataset.fav) {
      e.preventDefault();
      const f = FLOWER_MAP[t.dataset.fav];
      const on = Favorites.toggle(f.id);
      document.querySelectorAll(`[data-fav="${CSS.escape(f.id)}"]`).forEach((b) => {
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', `${f.name}を${on ? 'お気に入りから外す' : 'お気に入りに追加'}`);
        b.querySelector('.fav-label').textContent = on ? '♥' : '♡';
        if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      });
      toast(on ? `${f.name}をお気に入りに追加しました` : `${f.name}をお気に入りから外しました`);
      return;
    }
    if (t.dataset.random) {
      e.preventDefault();
      const r = parseHash(currentHash);
      go('#/flower/' + randomFlowerId(r.name === 'flower' ? r.param : null));
      return;
    }
    if (t.dataset.share) {
      e.preventDefault();
      shareFlower(FLOWER_MAP[t.dataset.share]);
      return;
    }
    if (t.dataset.q) {
      e.preventDefault();
      const key = t.dataset.q;
      state.queries[key] = t.dataset.word;
      const input = document.getElementById('search-' + key);
      if (input) input.value = t.dataset.word;
      updateResults(key);
      const details = t.closest('details');
      if (details) {
        details.open = false;
        if (input) input.scrollIntoView({ block: 'start' });
      }
      return;
    }
    if (t.dataset.monthTab) {
      e.preventDefault();
      state.monthTab = t.dataset.monthTab;
      viewEl.querySelectorAll('[data-month-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === t)));
      const panelEl = document.getElementById('month-panel');
      if (panelEl) panelEl.innerHTML = monthPanel(+panelEl.dataset.month);
      return;
    }
    if (t.dataset.clear) {
      e.preventDefault();
      const key = t.dataset.clear;
      state.queries[key] = '';
      const input = document.getElementById('search-' + key);
      if (input) { input.value = ''; input.focus(); }
      updateResults(key);
      return;
    }
    if (t.id === 'back-btn') {
      e.preventDefault();
      goBack();
      return;
    }
    if (t.dataset.replace && t.tagName === 'A') {
      // 五十音の行切り替えは履歴を積まない（戻るで一つ前の画面へ戻れるように）
      e.preventDefault();
      go(t.getAttribute('href'), true);
    }
  });

  // 日付が変わったら「今日の花」を更新（アプリを開いたままでも）
  function refreshTodayIfNeeded() {
    const el = viewEl.querySelector('[data-today]');
    if (el && el.dataset.today !== dateKey(new Date()) && !state.queries.home) render(true);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTodayIfNeeded(); });
  setInterval(refreshTodayIfNeeded, 60 * 1000);

  /* =========================================================
   * 起動
   * ======================================================= */
  function init() {
    Favorites.load();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('hashchange', onHashChange);
    const start = canonical(location.hash);
    // 詳細画面などに直接アクセスした場合も、戻るボタンで一覧へ戻れるようにする
    navStack.push(start);
    render(false);
    currentHash = start;
  }

  // 開発・テスト用に一部を公開
  window.HanaApp = { APP, FLOWERS, todaysFlower, search, norm, Favorites };

  init();
})();
