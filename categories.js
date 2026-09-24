/*
 * 花言葉 — 分類データ
 * 気持ち・贈る相手・シーン・五十音の定義です。
 * flowers.js の categories / recipients / scenes には、ここの id を指定します。
 */
(function () {
  'use strict';

  // 気持ちから探す
  const feelings = [
    { id: 'love',       label: '愛情・恋愛',       emoji: '💗', desc: '胸の奥にある「好き」を、そっと花に託して。' },
    { id: 'friendship', label: '友情',             emoji: '🤝', desc: '変わらない絆や、いつもの感謝を伝える花。' },
    { id: 'thanks',     label: '感謝',             emoji: '🎀', desc: '「ありがとう」を言葉以上にやさしく届ける花。' },
    { id: 'hope',       label: '希望',             emoji: '🌅', desc: 'これからの毎日が明るくなるように願う花。' },
    { id: 'happiness',  label: '幸福・祝福',       emoji: '🎉', desc: 'うれしい出来事を一緒に喜ぶための花。' },
    { id: 'respect',    label: '尊敬',             emoji: '👑', desc: '憧れや敬意を、上品に表してくれる花。' },
    { id: 'sincerity',  label: '誠実',             emoji: '🕊️', desc: 'まっすぐな気持ちや信頼を伝える花。' },
    { id: 'kindness',   label: '優しさ・思いやり', emoji: '🌷', desc: '相手を気づかう、あたたかな心を映す花。' },
    { id: 'cheer',      label: '応援・勇気',       emoji: '🔥', desc: '挑戦する人の背中を、明るく押してくれる花。' },
    { id: 'health',     label: '健康・長寿',       emoji: '🍵', desc: 'いつまでも元気でいてほしい人へ贈る花。' },
    { id: 'future',     label: '門出・未来',       emoji: '🚪', desc: '新しい一歩を踏み出す人に寄り添う花。' },
    { id: 'comfort',    label: '慰め・思い出',     emoji: '🌙', desc: '大切な記憶や、静かな想いに寄り添う花。' }
  ];

  // 贈る相手から探す
  const recipients = [
    { id: 'partner', label: '恋人・パートナー', emoji: '💞', desc: '愛情や変わらない想いを表す花言葉の花を選びました。' },
    { id: 'friend',  label: '友人',             emoji: '😊', desc: '友情や信頼、明るさを感じさせる花言葉の花です。' },
    { id: 'family',  label: '家族',             emoji: '🏡', desc: '絆や感謝、日々の幸せを表す花を集めました。' },
    { id: 'parents', label: '両親',             emoji: '👪', desc: '感謝や尊敬、長く元気でいてほしい気持ちを込められる花です。' },
    { id: 'teacher', label: '先生・恩師',       emoji: '📚', desc: '尊敬と感謝、門出を感じさせる花言葉の花です。' },
    { id: 'boss',    label: '上司・職場の人',   emoji: '💼', desc: '品のある印象で、敬意や感謝を伝えやすい花です。' },
    { id: 'child',   label: '子ども',           emoji: '🧸', desc: '無邪気さや希望、健やかな成長を願う花言葉の花です。' },
    { id: 'special', label: '大切な人',         emoji: '💐', desc: '相手を思う気持ちがまっすぐ伝わる花を選びました。' }
  ];

  // シーンから探す
  const scenes = [
    { id: 'birthday',    label: '誕生日',         emoji: '🎂', desc: '新しい一年を祝う、明るく前向きな花言葉の花。' },
    { id: 'wedding',     label: '結婚祝い',       emoji: '💒', desc: '永遠の愛や幸福を表す、祝福にふさわしい花。' },
    { id: 'birth',       label: '出産祝い',       emoji: '👶', desc: '小さな命の誕生と健やかな成長を願う花。' },
    { id: 'confession',  label: '告白',           emoji: '💌', desc: '言葉にしにくい想いを代わりに伝えてくれる花。' },
    { id: 'proposal',    label: 'プロポーズ',     emoji: '💍', desc: '「ずっと一緒に」という気持ちを託せる花。' },
    { id: 'graduation',  label: '卒業',           emoji: '🎓', desc: 'これまでの努力をたたえ、門出を祝う花。' },
    { id: 'entrance',    label: '入学',           emoji: '🌸', desc: '新しい生活への期待と希望に満ちた花。' },
    { id: 'farewell',    label: '退職・送別',     emoji: '👋', desc: '感謝と「これからも元気で」を伝える花。' },
    { id: 'cheer',       label: '応援',           emoji: '📣', desc: 'がんばる人に勇気と元気を届ける花。' },
    { id: 'visit',       label: 'お見舞い',       emoji: '🍀', desc: '回復を願う、やさしく明るい印象の花。' },
    { id: 'thanks',      label: '感謝を伝えたい', emoji: '🙏', desc: '「ありがとう」の気持ちがまっすぐ届く花。' },
    { id: 'anniversary', label: '記念日',         emoji: '🥂', desc: 'ふたりの時間を祝い、これからを誓う花。' },
    { id: 'mothersday',  label: '母の日',         emoji: '👩', desc: 'お母さんへの感謝と愛情を込められる花。' },
    { id: 'fathersday',  label: '父の日',         emoji: '👨', desc: 'お父さんへの尊敬と感謝を表す花。' }
  ];

  // 五十音
  const kanaRows = [
    { id: 'a',  label: 'あ', chars: 'あいうえお' },
    { id: 'ka', label: 'か', chars: 'かきくけこ' },
    { id: 'sa', label: 'さ', chars: 'さしすせそ' },
    { id: 'ta', label: 'た', chars: 'たちつてと' },
    { id: 'na', label: 'な', chars: 'なにぬねの' },
    { id: 'ha', label: 'は', chars: 'はひふへほ' },
    { id: 'ma', label: 'ま', chars: 'まみむめも' },
    { id: 'ya', label: 'や', chars: 'やゆよ' },
    { id: 'ra', label: 'ら', chars: 'らりるれろ' },
    { id: 'wa', label: 'わ', chars: 'わをん' }
  ];

  window.HANA_TAXONOMY = { feelings, recipients, scenes, kanaRows };
})();
