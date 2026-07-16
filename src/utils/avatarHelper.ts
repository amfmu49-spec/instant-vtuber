import type { PsdLayerData } from '../store/AppContext';

export const splitImageIntoHeadAndBody = (
  img: HTMLImageElement,
  neckYPercent: number, // 0 to 100
  removeWhiteBg: boolean = true
): PsdLayerData[] => {
  const width = img.width;
  const height = img.height;
  
  // 1. Create transparent base canvas
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return [];
  
  baseCtx.drawImage(img, 0, 0);
  
  // 2. Remove white background if requested
  if (removeWhiteBg) {
    const imgData = baseCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // 単純な白色（RGBがすべて240以上）または、ほぼ白に近い色を透過にする
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      if (r > 240 && g > 240 && b > 240) {
        data[i+3] = 0; // Alpha = 0
      }
    }
    baseCtx.putImageData(imgData, 0, 0);
  }
  
  const cutY = Math.round((neckYPercent / 100) * height);
  
  // 3. Create Head Canvas
  const headCanvas = document.createElement('canvas');
  headCanvas.width = width;
  headCanvas.height = cutY;
  const headCtx = headCanvas.getContext('2d');
  if (headCtx) {
    headCtx.drawImage(baseCanvas, 0, 0, width, cutY, 0, 0, width, cutY);
  }
  
  // 4. Create Body Canvas (15px overlapping upwards under the head to prevent gaps)
  const overlap = 15;
  const bodySourceY = Math.max(0, cutY - overlap);
  const bodyCanvasHeight = height - bodySourceY;
  
  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = width;
  bodyCanvas.height = bodyCanvasHeight;
  const bodyCtx = bodyCanvas.getContext('2d');
  if (bodyCtx) {
    bodyCtx.drawImage(baseCanvas, 0, bodySourceY, width, bodyCanvasHeight, 0, 0, width, bodyCanvasHeight);
  }
  
  return [
    {
      name: 'body',
      canvas: bodyCanvas,
      left: 0,
      top: bodySourceY,
      width: width,
      height: bodyCanvasHeight,
      visible: true,
      blendMode: 'source-over',
      opacity: 1
    },
    {
      name: 'head',
      canvas: headCanvas,
      left: 0,
      top: 0,
      width: width,
      height: cutY,
      visible: true,
      blendMode: 'source-over',
      opacity: 1
    }
  ];
};

const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const MOUTH_INDICES = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 61, 291, 37, 267];

const getLandmarksBoundingBox = (
  landmarks: { x: number; y: number; z: number }[],
  indices: number[],
  imgWidth: number,
  imgHeight: number,
  paddingPercent: number = 0.2
) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  indices.forEach(idx => {
    const pt = landmarks[idx];
    if (!pt) return;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  const w = maxX - minX;
  const h = maxY - minY;

  const padX = w * paddingPercent;
  const padY = h * paddingPercent;

  const left = Math.max(0, Math.floor((minX - padX) * imgWidth));
  const top = Math.max(0, Math.floor((minY - padY) * imgHeight));
  const right = Math.min(imgWidth, Math.ceil((maxX + padX) * imgWidth));
  const bottom = Math.min(imgHeight, Math.ceil((maxY + padY) * imgHeight));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    relLeft: minX,
    relTop: minY,
    relWidth: w,
    relHeight: h
  };
};

export interface GridExpressionCanvases {
  closedLeftEye: HTMLCanvasElement | null;
  closedRightEye: HTMLCanvasElement | null;
  openMouth: HTMLCanvasElement | null;
  baseFaceQuad: { left: number; top: number; width: number; height: number };
  baseLeftEyeRect: any;
  baseRightEyeRect: any;
  baseMouthRect: any;
}

export const parseGridSheet = (
  img: HTMLImageElement,
  multiFaceLandmarks: any[]
): GridExpressionCanvases | null => {
  const width = img.width;
  const height = img.height;

  if (!multiFaceLandmarks || multiFaceLandmarks.length < 2) {
    return null;
  }

  // 1. 背景除去した全体のベースキャンバスを作成
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const ctx = baseCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
      data[i+3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. 各顔のスコア算出
  const scores = multiFaceLandmarks.map((landmarks, index) => {
    const leftEyeDist = Math.abs(landmarks[159].y - landmarks[145].y);
    const rightEyeDist = Math.abs(landmarks[386].y - landmarks[374].y);
    const eyeOpenScore = (leftEyeDist + rightEyeDist) / 2;
    const mouthOpenScore = Math.abs(landmarks[13].y - landmarks[14].y);
    return { index, eyeOpenScore, mouthOpenScore, landmarks };
  });

  // 目の開きが最小 ＝ 閉じ目の顔
  const sortedByEyes = [...scores].sort((a, b) => a.eyeOpenScore - b.eyeOpenScore);
  const closedEyesFace = sortedByEyes[0];

  // 口の開きが最大 ＝ 口開きの顔
  const sortedByMouth = [...scores].sort((a, b) => b.mouthOpenScore - a.mouthOpenScore);
  const openMouthFace = sortedByMouth[0];

  // ベースとなる顔（通常顔。目が開いていて口が閉じているもの）
  let baseFace = scores.find(s => s.index !== closedEyesFace.index && s.index !== openMouthFace.index);
  if (!baseFace) {
    baseFace = scores.find(s => s.index !== closedEyesFace.index) || scores[0];
  }

  // 3. ベース顔が属する2x2のクアドラント（象限）を判定
  const baseLandmarks = baseFace.landmarks;
  const avgX = baseLandmarks.reduce((sum: number, pt: any) => sum + pt.x, 0) / baseLandmarks.length;
  const avgY = baseLandmarks.reduce((sum: number, pt: any) => sum + pt.y, 0) / baseLandmarks.length;

  const quadX = avgX < 0.5 ? 0 : 0.5;
  const quadY = avgY < 0.5 ? 0 : 0.5;
  const quadWidth = 0.5;
  const quadHeight = 0.5;

  const baseFaceQuad = {
    left: Math.floor(quadX * width),
    top: Math.floor(quadY * height),
    width: Math.floor(quadWidth * width),
    height: Math.floor(quadHeight * height)
  };

  const cropPart = (box: any) => {
    const c = document.createElement('canvas');
    c.width = box.width;
    c.height = box.height;
    const cCtx = c.getContext('2d');
    if (cCtx) {
      cCtx.drawImage(baseCanvas, box.left, box.top, box.width, box.height, 0, 0, box.width, box.height);
    }
    return c;
  };

  // 4. 表情パーツの切り出し
  const closedEyesBoxLeft = getLandmarksBoundingBox(closedEyesFace.landmarks, LEFT_EYE_INDICES, width, height, 0.35);
  const closedEyesBoxRight = getLandmarksBoundingBox(closedEyesFace.landmarks, RIGHT_EYE_INDICES, width, height, 0.35);
  const openMouthBox = getLandmarksBoundingBox(openMouthFace.landmarks, MOUTH_INDICES, width, height, 0.3);

  const closedLeftEye = cropPart(closedEyesBoxLeft);
  const closedRightEye = cropPart(closedEyesBoxRight);
  const openMouth = cropPart(openMouthBox);

  // 5. ベース顔側での各パーツ位置（クアドラント基準の相対座標へ変換するため）
  const baseLeftEyeBox = getLandmarksBoundingBox(baseFace.landmarks, LEFT_EYE_INDICES, width, height, 0.35);
  const baseRightEyeBox = getLandmarksBoundingBox(baseFace.landmarks, RIGHT_EYE_INDICES, width, height, 0.35);
  const baseMouthBox = getLandmarksBoundingBox(baseFace.landmarks, MOUTH_INDICES, width, height, 0.3);

  // クアドラントの左上からのオフセット値に変換
  const toQuadRect = (box: any) => {
    return {
      left: box.left - baseFaceQuad.left,
      top: box.top - baseFaceQuad.top,
      width: box.width,
      height: box.height
    };
  };

  return {
    closedLeftEye,
    closedRightEye,
    openMouth,
    baseFaceQuad,
    baseLeftEyeRect: toQuadRect(baseLeftEyeBox),
    baseRightEyeRect: toQuadRect(baseRightEyeBox),
    baseMouthRect: toQuadRect(baseMouthBox)
  };
};
