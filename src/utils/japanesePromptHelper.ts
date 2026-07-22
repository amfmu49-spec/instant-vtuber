// 日本語の短文プロンプトを自動判別し、アニメ画像生成用英語プロンプトに変換・拡張するヘルパー

const JAPANESE_DICTIONARY: { [key: string]: string } = {
  // 髪色
  '銀髪': 'silver hair',
  '白髪': 'white hair',
  '黒髪': 'black hair',
  '金髪': 'blonde hair',
  '赤髪': 'red hair',
  'ピンク髪': 'pink hair',
  '桃髪': 'pink hair',
  '青髪': 'blue hair',
  '水色髪': 'light blue hair',
  '紫髪': 'purple hair',
  '茶髪': 'brown hair',
  '緑髪': 'green hair',

  // 髪型
  'ツインテール': 'twintails',
  'ポニーテール': 'ponytail',
  'ショート': 'short hair',
  'ロング': 'long hair',
  'ボブ': 'bob hair',
  'お団子': 'hair bun',
  '三つ編み': 'braided hair',
  'ウェーブ': 'wavy hair',

  // 目の色・特徴
  '赤目': 'red eyes',
  '青目': 'blue eyes',
  '碧眼': 'blue eyes',
  '金眼': 'golden eyes',
  '黄眼': 'yellow eyes',
  '緑眼': 'green eyes',
  '紫眼': 'purple eyes',
  'オッドアイ': 'heterochromia eyes',
  'ジト目': 'sanpaku eyes, sleepy expression',
  'たれ目': 'droopy eyes',

  // 装飾・属性
  '猫耳': 'cat ears',
  'ネコミミ': 'cat ears',
  'ねこみみ': 'cat ears',
  '狐耳': 'fox ears',
  'きつね耳': 'fox ears',
  'うさ耳': 'rabbit ears',
  'ウサ耳': 'rabbit ears',
  '悪魔': 'demon horns and wings',
  '天使': 'angel halo and wings',
  '八重歯': 'small fang',
  'メガネ': 'glasses',
  '眼鏡': 'glasses',
  'リボン': 'hair ribbon',

  // 衣装・スタイル
  'セーラー服': 'sailor uniform',
  'セーラー': 'sailor uniform',
  'メイド': 'maid outfit',
  'ゴシック': 'gothic lolita dress',
  'ゴスロリ': 'gothic lolita dress',
  '巫女': 'shrine maiden miko outfit',
  '和風': 'traditional japanese kimono outfit',
  '着物': 'kimono outfit',
  'サイバー': 'cyberpunk outfit',
  'アイドル': 'cute idol dress',
  '制服': 'school uniform',
  'パーカー': 'oversized hoodie',
  'ジャージ': 'track jacket',
  'パジャマ': 'cute pajamas',
  '水着': 'swimsuit',

  // 性別・タイプ
  '女の子': 'cute anime girl',
  '少女': 'young anime girl',
  '美少女': 'beautiful anime girl',
  '男の子': 'handsome anime boy',
  '少年': 'young anime boy',
  'ギャル': 'gal anime girl',
  '小悪魔': 'cute little demon girl'
};

export const translateJapanesePromptToEnglish = (inputText: string): string => {
  const trimmed = inputText.trim();
  if (!trimmed) return "cute anime girl with silver hair, twintails, blue eyes, sailor uniform";

  let translatedTerms: string[] = [];

  // 辞書マッチング
  for (const [jpKey, enVal] of Object.entries(JAPANESE_DICTIONARY)) {
    if (trimmed.includes(jpKey)) {
      translatedTerms.push(enVal);
    }
  }

  // 日本語が含まれている場合、抽出結果をまとめる
  const containsJapanese = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(trimmed);

  if (containsJapanese) {
    if (translatedTerms.length > 0) {
      return translatedTerms.join(', ') + `, ${trimmed}`;
    } else {
      return `cute anime character, ${trimmed}`;
    }
  }

  return trimmed;
};
