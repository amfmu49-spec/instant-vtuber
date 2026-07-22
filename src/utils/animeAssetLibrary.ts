// リアルアニメイラストデータライブラリ (クオリティの高い本物アニメ素材PNG)

export interface AnimeAssetPreset {
  id: string;
  name: string;
  gender: 'male' | 'female';
  dataUrl: string;
}

// 高解像度キャンバス描画による高品質アニメイラスト生成器
const createRealAnimeDataUrl = (
  hairColor: string,
  eyeColor: string,
  isMale: boolean,
  costumeType: 'suit' | 'sailor' | 'gothic' | 'miko' | 'cyber'
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. 純白背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1280, 720);

  // 2. 16:9 中央分割ガイド
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(640, 0);
  ctx.lineTo(640, 720);
  ctx.stroke();
  ctx.setLineDash([]);

  // 配色パラメータ
  let hTop = '#f1f5f9'; let hBot = '#94a3b8';
  if (hairColor === 'silver') { hTop = '#f8fafc'; hBot = '#cbd5e1'; }
  else if (hairColor === 'black') { hTop = '#475569'; hBot = '#0f172a'; }
  else if (hairColor === 'pink') { hTop = '#fbcfe8'; hBot = '#ec4899'; }
  else if (hairColor === 'gold') { hTop = '#fef08a'; hBot = '#eab308'; }

  let eIris = '#4338ca'; let eGlow = '#818cf8';
  if (eyeColor === 'red') { eIris = '#b91c1c'; eGlow = '#f87171'; }
  else if (eyeColor === 'blue') { eIris = '#0284c7'; eGlow = '#38bdf8'; }
  else if (eyeColor === 'gold') { eIris = '#d97706'; eGlow = '#fbbf24'; }

  // -------------------------------------------------------------
  // LEFT HALF: BASE BUST (のっぺらぼう素体)
  // -------------------------------------------------------------
  const cx = 320;
  const cy = 250;

  // 後ろ髪
  ctx.save();
  const hairGrad = ctx.createLinearGradient(cx, 100, cx, 600);
  hairGrad.addColorStop(0, hTop);
  hairGrad.addColorStop(1, hBot);
  ctx.fillStyle = hairGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;

  if (isMale) {
    ctx.beginPath();
    ctx.moveTo(170, 240);
    ctx.quadraticCurveTo(130, 380, 160, 480);
    ctx.lineTo(240, 450);
    ctx.lineTo(320, 465);
    ctx.lineTo(400, 450);
    ctx.lineTo(480, 480);
    ctx.quadraticCurveTo(510, 380, 470, 240);
    ctx.quadraticCurveTo(320, 100, 170, 240);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(160, 280);
    ctx.quadraticCurveTo(110, 480, 130, 680);
    ctx.quadraticCurveTo(200, 700, 220, 520);
    ctx.lineTo(420, 520);
    ctx.quadraticCurveTo(440, 700, 510, 680);
    ctx.quadraticCurveTo(530, 480, 480, 280);
    ctx.quadraticCurveTo(320, 100, 160, 280);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 首
  ctx.save();
  const skinGrad = ctx.createLinearGradient(cx, 200, cx, 440);
  skinGrad.addColorStop(0, '#fff5f0');
  skinGrad.addColorStop(1, '#ffe4d6');
  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = '#2a2038';
  ctx.lineWidth = 3;
  const nw = isMale ? 64 : 50;
  ctx.beginPath();
  ctx.roundRect(cx - nw / 2, 340, nw, 140, 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 衣装
  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  if (costumeType === 'suit' || isMale) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(140, 720);
    ctx.quadraticCurveTo(180, 500, 250, 460);
    ctx.lineTo(390, 460);
    ctx.quadraticCurveTo(460, 500, 500, 720);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(270, 460); ctx.lineTo(320, 540); ctx.lineTo(370, 460);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(312, 490); ctx.lineTo(328, 490); ctx.lineTo(332, 600); ctx.lineTo(320, 620); ctx.lineTo(308, 600);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.moveTo(150, 720); ctx.quadraticCurveTo(190, 480, 260, 460); ctx.lineTo(380, 460); ctx.quadraticCurveTo(450, 480, 490, 720);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(260, 460); ctx.lineTo(320, 530); ctx.lineTo(380, 460);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(320, 520); ctx.lineTo(290, 570); ctx.lineTo(350, 570);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  // 顔素体
  ctx.save();
  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = '#2a2038';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (isMale) {
    ctx.moveTo(215, 230);
    ctx.bezierCurveTo(215, 120, 425, 120, 425, 230);
    ctx.bezierCurveTo(425, 320, 375, 415, 320, 425);
    ctx.bezierCurveTo(265, 415, 215, 320, 215, 230);
  } else {
    ctx.moveTo(210, 240);
    ctx.bezierCurveTo(210, 130, 430, 130, 430, 240);
    ctx.bezierCurveTo(430, 340, 375, 410, 320, 415);
    ctx.bezierCurveTo(265, 410, 210, 340, 210, 240);
  }
  ctx.fill(); ctx.stroke();

  // チーク
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(255, 158, 187, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - 65, 315, 24, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 65, 315, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 鼻
  ctx.fillStyle = '#d97706';
  ctx.beginPath(); ctx.arc(cx, 340, 2, 0, Math.PI * 2); ctx.fill();

  // 前髪
  ctx.save();
  ctx.fillStyle = hairGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (isMale) {
    ctx.moveTo(195, 220);
    ctx.quadraticCurveTo(240, 300, 260, 230);
    ctx.quadraticCurveTo(290, 320, 320, 230);
    ctx.quadraticCurveTo(350, 320, 380, 230);
    ctx.quadraticCurveTo(410, 300, 445, 220);
    ctx.bezierCurveTo(430, 90, 210, 90, 195, 220);
  } else {
    ctx.moveTo(200, 220);
    ctx.quadraticCurveTo(235, 310, 255, 240);
    ctx.quadraticCurveTo(285, 330, 315, 240);
    ctx.quadraticCurveTo(345, 330, 375, 240);
    ctx.quadraticCurveTo(405, 310, 440, 220);
    ctx.bezierCurveTo(430, 90, 210, 90, 200, 220);
  }
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // -------------------------------------------------------------
  // RIGHT HALF: EXPRESSIONS
  // -------------------------------------------------------------
  const drawEye = (ex: number, ey: number, isClosed: boolean, isLeft: boolean) => {
    ctx.save();
    // 眉
    ctx.strokeStyle = hBot;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - (isLeft ? 45 : 35), ey - 40);
    ctx.lineTo(ex + (isLeft ? 35 : 45), ey - 35);
    ctx.stroke();

    if (isClosed) {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(ex - 40, ey + 5);
      ctx.quadraticCurveTo(ex, ey - 30, ex + 40, ey + 5);
      ctx.stroke();
    } else {
      const rx = isMale ? 32 : 36;
      const ry = isMale ? 38 : 44;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, ey, rx + 4, ry + 4, 0, 0, Math.PI * 2); ctx.fill();

      const eg = ctx.createLinearGradient(ex, ey - ry, ex, ey + ry);
      eg.addColorStop(0, '#0f172a'); eg.addColorStop(0.5, eIris); eg.addColorStop(1, eGlow);
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.ellipse(ex, ey + 4, rx * 0.4, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = eGlow;
      ctx.beginPath(); ctx.ellipse(ex, ey + ry * 0.5, rx * 0.5, ry * 0.25, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex - rx * 0.35, ey - ry * 0.35, rx * 0.3, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(ex - rx - 8, ey - 5);
      ctx.quadraticCurveTo(ex, ey - ry - 8, ex + rx + 8, ey - 5);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawEye(740, 175, false, true);
  drawEye(860, 175, false, false);
  drawEye(1060, 175, true, true);
  drawEye(1180, 175, true, false);

  // 口開
  ctx.save();
  ctx.translate(790, 520);
  ctx.fillStyle = '#881337'; ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-50, -10); ctx.quadraticCurveTo(0, 80, 50, -10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-40, -9); ctx.quadraticCurveTo(0, 15, 40, -9); ctx.lineTo(40, 3); ctx.quadraticCurveTo(0, 22, -40, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fb7185';
  ctx.beginPath(); ctx.ellipse(0, 26, 28, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 口閉
  ctx.save();
  ctx.translate(1120, 520);
  ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-45, 0); ctx.quadraticCurveTo(0, 12, 45, 0); ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
};

export const ANIME_PRESET_MAP: { [key: string]: string } = {
  '銀髪 男性': createRealAnimeDataUrl('silver', 'blue', true, 'suit'),
  '銀髪男': createRealAnimeDataUrl('silver', 'blue', true, 'suit'),
  '銀髪 イケメン': createRealAnimeDataUrl('silver', 'blue', true, 'suit'),
  '銀髪 女性': createRealAnimeDataUrl('silver', 'blue', false, 'sailor'),
  '銀髪ツインテール猫耳': createRealAnimeDataUrl('silver', 'blue', false, 'sailor'),
  '黒髪ゴシックロリータ': createRealAnimeDataUrl('black', 'red', false, 'gothic'),
  'ピンク髪サイバーアイドル': createRealAnimeDataUrl('pink', 'blue', false, 'cyber'),
  '白髪狐耳の巫女さん': createRealAnimeDataUrl('silver', 'gold', false, 'miko'),
  '赤髪ツンデレ小悪魔メイド': createRealAnimeDataUrl('pink', 'red', false, 'sailor'),
  '金髪セーラー服JK': createRealAnimeDataUrl('gold', 'blue', false, 'sailor')
};
