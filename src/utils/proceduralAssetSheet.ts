import { ANIME_PRESET_MAP } from './animeAssetLibrary';

export const generateProceduralAssetSheetDataUrl = (promptText: string): string => {
  const trimmed = promptText.trim();
  if (ANIME_PRESET_MAP[trimmed]) {
    return ANIME_PRESET_MAP[trimmed];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const lowerPrompt = promptText.toLowerCase();

  // 性別判別 (Male vs Female)
  const isMale = lowerPrompt.includes('男性') || lowerPrompt.includes('男') || lowerPrompt.includes('boy') || lowerPrompt.includes('male') || lowerPrompt.includes('イケメン') || lowerPrompt.includes('王子');

  // 髪色判定
  let hairTop = '#f1f5f9';
  let hairBot = '#cbd5e1';
  let hairDark = '#64748b';

  if (lowerPrompt.includes('pink') || lowerPrompt.includes('桃') || lowerPrompt.includes('ピンク')) {
    hairTop = '#fbcfe8'; hairBot = '#f472b6'; hairDark = '#9d174d';
  } else if (lowerPrompt.includes('black') || lowerPrompt.includes('黒')) {
    hairTop = '#475569'; hairBot = '#1e293b'; hairDark = '#020617';
  } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金') || lowerPrompt.includes('ブロンド')) {
    hairTop = '#fef08a'; hairBot = '#eab308'; hairDark = '#854d0e';
  } else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) {
    hairTop = '#e9d5ff'; hairBot = '#a855f7'; hairDark = '#581c87';
  } else if (lowerPrompt.includes('blue') || lowerPrompt.includes('青') || lowerPrompt.includes('水')) {
    hairTop = '#bae6fd'; hairBot = '#0ea5e9'; hairDark = '#0369a1';
  } else if (lowerPrompt.includes('red') || lowerPrompt.includes('赤')) {
    hairTop = '#fca5a5'; hairBot = '#ef4444'; hairDark = '#991b1b';
  }

  // 瞳の色判定
  let irisTop = '#1e1b4b';
  let irisMid = '#4338ca';
  let irisBot = '#818cf8';

  if (lowerPrompt.includes('red') || lowerPrompt.includes('赤') || lowerPrompt.includes('crimson')) {
    irisTop = '#450a0a'; irisMid = '#b91c1c'; irisBot = '#f87171';
  } else if (lowerPrompt.includes('green') || lowerPrompt.includes('緑')) {
    irisTop = '#052e16'; irisMid = '#15803d'; irisBot = '#4ade80';
  } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金')) {
    irisTop = '#451a03'; irisMid = '#d97706'; irisBot = '#fbbf24';
  } else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) {
    irisTop = '#3b0764'; irisMid = '#7e22ce'; irisBot = '#c084fc';
  }

  // 背景クリア（純白）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1280, 720);

  // 左右中央分割ガイド線（破線）
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(640, 0);
  ctx.lineTo(640, 720);
  ctx.stroke();
  ctx.setLineDash([]); // リセット

  // ==========================================
  // LEFT HALF: BLANK FACE BUST (0 ~ 640 X)
  // ==========================================
  const centerX = 320;
  const centerY = 260;

  // 1. 後ろ髪 (Back Hair)
  ctx.save();
  const backHairGrad = ctx.createLinearGradient(centerX, 100, centerX, 600);
  backHairGrad.addColorStop(0, hairTop);
  backHairGrad.addColorStop(0.7, hairBot);
  backHairGrad.addColorStop(1, hairDark);
  ctx.fillStyle = backHairGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;

  if (isMale) {
    // 男性型：シャープなレイヤーショート
    ctx.beginPath();
    ctx.moveTo(180, 240);
    ctx.quadraticCurveTo(140, 350, 160, 480);
    ctx.lineTo(240, 450);
    ctx.lineTo(320, 460);
    ctx.lineTo(400, 450);
    ctx.lineTo(480, 480);
    ctx.quadraticCurveTo(500, 350, 460, 240);
    ctx.quadraticCurveTo(320, 100, 180, 240);
    ctx.fill();
    ctx.stroke();
  } else {
    // 女性型：美しいサイドツインテール/ロング
    ctx.beginPath();
    ctx.moveTo(160, 280);
    ctx.quadraticCurveTo(110, 450, 130, 680);
    ctx.quadraticCurveTo(200, 700, 220, 520);
    ctx.lineTo(420, 520);
    ctx.quadraticCurveTo(440, 700, 510, 680);
    ctx.quadraticCurveTo(530, 450, 480, 280);
    ctx.quadraticCurveTo(320, 100, 160, 280);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 2. 首・首影 (Neck & Neck Shadow)
  ctx.save();
  // 首のグラデーション
  const skinGrad = ctx.createLinearGradient(centerX, 200, centerX, 440);
  skinGrad.addColorStop(0, '#fff5f0');
  skinGrad.addColorStop(1, '#ffe4d6');

  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = '#2a2038';
  ctx.lineWidth = 3;

  const neckW = isMale ? 64 : 50;
  ctx.beginPath();
  ctx.roundRect(centerX - neckW / 2, 340, neckW, 140, 12);
  ctx.fill();
  ctx.stroke();

  // 首影 (Ambient Occlusion)
  ctx.fillStyle = 'rgba(234, 150, 120, 0.35)';
  ctx.beginPath();
  ctx.ellipse(centerX, 375, neckW / 2 + 4, 18, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // 3. 衣装 (Outfit: Shirt/Suit or Sailor/Dress)
  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;

  if (isMale) {
    // 男性用：スタイリッシュなスーツジャケット＆ネクタイ
    const outfitGrad = ctx.createLinearGradient(centerX, 460, centerX, 720);
    outfitGrad.addColorStop(0, '#1e293b');
    outfitGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = outfitGrad;

    ctx.beginPath();
    ctx.moveTo(140, 720);
    ctx.quadraticCurveTo(180, 500, 250, 460);
    ctx.lineTo(390, 460);
    ctx.quadraticCurveTo(460, 500, 500, 720);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ワイシャツ襟
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(270, 460);
    ctx.lineTo(320, 540);
    ctx.lineTo(370, 460);
    ctx.lineTo(340, 460);
    ctx.lineTo(320, 500);
    ctx.lineTo(300, 460);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 赤いタイ
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(312, 490);
    ctx.lineTo(328, 490);
    ctx.lineTo(332, 600);
    ctx.lineTo(320, 620);
    ctx.lineTo(308, 600);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else {
    // 女性用：シックなセーラー/ドレス
    const dressGrad = ctx.createLinearGradient(centerX, 460, centerX, 720);
    dressGrad.addColorStop(0, '#312e81');
    dressGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = dressGrad;

    ctx.beginPath();
    ctx.moveTo(150, 720);
    ctx.quadraticCurveTo(190, 480, 260, 460);
    ctx.lineTo(380, 460);
    ctx.quadraticCurveTo(450, 480, 490, 720);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 襟＆リボン
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(260, 460);
    ctx.lineTo(320, 530);
    ctx.lineTo(380, 460);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(320, 520);
    ctx.lineTo(290, 570);
    ctx.lineTo(350, 570);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 4. 顔素体 (Blank Face Contour - Smooth Anime Jawline)
  ctx.save();
  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = '#2a2038';
  ctx.lineWidth = 3.5;

  ctx.beginPath();
  if (isMale) {
    // 男性型：シャープな顎ライン
    ctx.moveTo(215, 230);
    ctx.bezierCurveTo(215, 120, 425, 120, 425, 230);
    ctx.bezierCurveTo(425, 320, 375, 415, 320, 425);
    ctx.bezierCurveTo(265, 415, 215, 320, 215, 230);
  } else {
    // 女性型：丸みのある可愛い顎ライン
    ctx.moveTo(210, 240);
    ctx.bezierCurveTo(210, 130, 430, 130, 430, 240);
    ctx.bezierCurveTo(430, 340, 375, 410, 320, 415);
    ctx.bezierCurveTo(265, 410, 210, 340, 210, 240);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 頬のほんのりチーク (Blush)
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(255, 158, 187, 0.5)';
  ctx.beginPath();
  ctx.ellipse(centerX - 65, 315, 24, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(centerX + 65, 315, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 控えめな鼻のポッチ
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(centerX, 340, 2, 0, Math.PI * 2);
  ctx.fill();

  // 5. 前髪 (Multi-strand Anime Bangs)
  ctx.save();
  const frontHairGrad = ctx.createLinearGradient(centerX, 100, centerX, 300);
  frontHairGrad.addColorStop(0, hairTop);
  frontHairGrad.addColorStop(0.8, hairBot);
  frontHairGrad.addColorStop(1, hairDark);

  ctx.fillStyle = frontHairGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3.5;

  ctx.beginPath();
  if (isMale) {
    // 男性の前髪：かっこいい毛束
    ctx.moveTo(195, 220);
    ctx.quadraticCurveTo(240, 300, 260, 230);
    ctx.quadraticCurveTo(290, 320, 320, 230);
    ctx.quadraticCurveTo(350, 320, 380, 230);
    ctx.quadraticCurveTo(410, 300, 445, 220);
    ctx.bezierCurveTo(430, 90, 210, 90, 195, 220);
  } else {
    // 女性の前髪：シースルーバングス
    ctx.moveTo(200, 220);
    ctx.quadraticCurveTo(235, 310, 255, 240);
    ctx.quadraticCurveTo(285, 330, 315, 240);
    ctx.quadraticCurveTo(345, 330, 375, 240);
    ctx.quadraticCurveTo(405, 310, 440, 220);
    ctx.bezierCurveTo(430, 90, 210, 90, 200, 220);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 天使の輪（髪のハイライト光沢）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(centerX, 190, 95, Math.PI * 0.85, Math.PI * 1.15, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, 190, 95, Math.PI * 1.85, Math.PI * 2.15, false);
  ctx.stroke();
  ctx.restore();

  // ==========================================
  // RIGHT HALF: ORGANIZED EXPRESSION PARTS
  // ==========================================

  // ヘルパー：高品質なアニメ目を描画
  const drawAnimeEye = (cx: number, cy: number, isClosed: boolean, isLeft: boolean) => {
    ctx.save();

    // 眉毛
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isMale) {
      // 男性のシャープな眉
      ctx.moveTo(cx - (isLeft ? 45 : 35), cy - 42);
      ctx.lineTo(cx + (isLeft ? 35 : 45), cy - 35);
    } else {
      // 女性の緩やかなアーチ眉
      ctx.moveTo(cx - (isLeft ? 45 : 35), cy - 40);
      ctx.quadraticCurveTo(cx, cy - 55, cx + (isLeft ? 35 : 45), cy - 40);
    }
    ctx.stroke();

    if (isClosed) {
      // 閉じた目（まつ毛ライン + にっこりカーブ）
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(cx - 40, cy + 5);
      ctx.quadraticCurveTo(cx, cy - 30, cx + 40, cy + 5);
      ctx.stroke();

      // 目尻の二重羽
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx + (isLeft ? -35 : 35), cy - 10);
      ctx.lineTo(cx + (isLeft ? -48 : 48), cy - 18);
      ctx.stroke();

      // 二重まぶたライン
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy - 25);
      ctx.quadraticCurveTo(cx, cy - 38, cx + 30, cy - 25);
      ctx.stroke();

    } else {
      // 開いた目（グラデーション虹彩 + キラキラアイ）
      const rx = isMale ? 32 : 36;
      const ry = isMale ? 38 : 44;

      // 1. 白目
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. 虹彩グラデーション (Iris Gradient)
      const eyeGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
      eyeGrad.addColorStop(0, irisTop);
      eyeGrad.addColorStop(0.5, irisMid);
      eyeGrad.addColorStop(1, irisBot);
      ctx.fillStyle = eyeGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 瞳孔 (Pupil)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, rx * 0.4, ry * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. 虹彩の輝きリング (Glow Ring)
      ctx.fillStyle = irisBot;
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.5, rx * 0.5, ry * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // 5. キャッチライト (Dual High-lights)
      // 主光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.35, cy - ry * 0.35, rx * 0.3, ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // 副光
      ctx.beginPath();
      ctx.arc(cx + rx * 0.35, cy + ry * 0.35, rx * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // 6. 上まつげアイライン (Upper Eyelash Wing)
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - rx - 8, cy - 5);
      ctx.quadraticCurveTo(cx, cy - ry - 8, cx + rx + 8, cy - 5);
      ctx.stroke();

      // 目尻の羽
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(cx + (isLeft ? -rx : rx), cy - 10);
      ctx.lineTo(cx + (isLeft ? -rx - 15 : rx + 15), cy - 20);
      ctx.stroke();

      // 下まつげ
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.6, cy + ry * 0.85);
      ctx.quadraticCurveTo(cx, cy + ry * 1.05, cx + rx * 0.6, cy + ry * 0.85);
      ctx.stroke();

      // 二重まぶたライン
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.7, cy - ry - 14);
      ctx.quadraticCurveTo(cx, cy - ry - 22, cx + rx * 0.7, cy - ry - 14);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Quadrant 1: Both Eyes Open (Left Eye & Right Eye)
  drawAnimeEye(740, 175, false, true);  // Left Eye Open
  drawAnimeEye(860, 175, false, false); // Right Eye Open

  // Quadrant 2: Both Eyes Closed (Left Eye & Right Eye)
  drawAnimeEye(1060, 175, true, true);  // Left Eye Closed
  drawAnimeEye(1180, 175, true, false); // Right Eye Closed

  // Quadrant 3: Mouth Open (Bottom-Left of Right Half)
  ctx.save();
  ctx.translate(790, 520);
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 4;

  // 口の開口（深紅のグラデーション）
  const mouthGrad = ctx.createLinearGradient(0, -20, 0, 40);
  mouthGrad.addColorStop(0, '#881337');
  mouthGrad.addColorStop(1, '#4c0519');
  ctx.fillStyle = mouthGrad;

  ctx.beginPath();
  ctx.moveTo(-50, -10);
  ctx.quadraticCurveTo(0, 80, 50, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 上歯 (White Teeth)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-40, -9);
  ctx.quadraticCurveTo(0, 15, 40, -9);
  ctx.lineTo(40, 3);
  ctx.quadraticCurveTo(0, 22, -40, 3);
  ctx.closePath();
  ctx.fill();

  // 舌 (Cute Pink Tongue)
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.ellipse(0, 26, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Quadrant 4: Mouth Neutral (Bottom-Right of Right Half)
  ctx.save();
  ctx.translate(1120, 520);
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-45, 0);
  ctx.quadraticCurveTo(0, 12, 45, 0);
  ctx.stroke();

  // 控えめな下唇影
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-15, 12);
  ctx.quadraticCurveTo(0, 18, 15, 12);
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
};
