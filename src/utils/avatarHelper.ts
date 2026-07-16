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
  openMouths: {
    a: HTMLCanvasElement | null;
    i: HTMLCanvasElement | null;
    u: HTMLCanvasElement | null;
    e: HTMLCanvasElement | null;
    o: HTMLCanvasElement | null;
  };
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

  // 2. グリッドサイズ（2x2 か 3x3 か）を検出
  let maxCol = 0;
  let maxRow = 0;
  multiFaceLandmarks.forEach((landmarks) => {
    const avgX = landmarks.reduce((sum: number, pt: any) => sum + pt.x, 0) / landmarks.length;
    const avgY = landmarks.reduce((sum: number, pt: any) => sum + pt.y, 0) / landmarks.length;
    const col = Math.floor(avgX * 3);
    const row = Math.floor(avgY * 3);
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  });

  const is3x3 = (maxCol >= 2 || maxRow >= 2);
  const gridCount = is3x3 ? 3 : 2;
  const cellSize = 1.0 / gridCount;

  // 3. 各顔のグリッド座標セルマップを構築
  const faceMap: Record<number, any> = {};
  multiFaceLandmarks.forEach((landmarks) => {
    const avgX = landmarks.reduce((sum: number, pt: any) => sum + pt.x, 0) / landmarks.length;
    const avgY = landmarks.reduce((sum: number, pt: any) => sum + pt.y, 0) / landmarks.length;
    const col = Math.min(gridCount - 1, Math.max(0, Math.floor(avgX * gridCount)));
    const row = Math.min(gridCount - 1, Math.max(0, Math.floor(avgY * gridCount)));
    const cellIndex = row * gridCount + col;
    faceMap[cellIndex] = landmarks;
  });

  // ベース顔（通常顔）＝常に Cell 0 (左上)
  let baseFace = faceMap[0];
  if (!baseFace) {
    baseFace = multiFaceLandmarks[0];
  }

  // 4. ベース顔が属するクアドラントを判定（基本的に左上 Cell 0）
  const baseFaceQuad = {
    left: 0,
    top: 0,
    width: Math.floor(cellSize * width),
    height: Math.floor(cellSize * height)
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

  // 5. 閉じ目パーツの切り出し (Cell 1 ＝ 上段中央)
  const closedEyesFace = faceMap[1];
  let closedLeftEye: HTMLCanvasElement | null = null;
  let closedRightEye: HTMLCanvasElement | null = null;

  if (closedEyesFace) {
    const closedEyesBoxLeft = getLandmarksBoundingBox(closedEyesFace, LEFT_EYE_INDICES, width, height, 0.35);
    const closedEyesBoxRight = getLandmarksBoundingBox(closedEyesFace, RIGHT_EYE_INDICES, width, height, 0.35);
    closedLeftEye = cropPart(closedEyesBoxLeft);
    closedRightEye = cropPart(closedEyesBoxRight);
    applyFeatherBox(closedLeftEye, Math.max(3, Math.floor(closedLeftEye.width * 0.15)));
    applyFeatherBox(closedRightEye, Math.max(3, Math.floor(closedRightEye.width * 0.15)));
  }

  // 6. 口のあいうえおパーツの切り出し
  const openMouths = {
    a: null as HTMLCanvasElement | null,
    i: null as HTMLCanvasElement | null,
    u: null as HTMLCanvasElement | null,
    e: null as HTMLCanvasElement | null,
    o: null as HTMLCanvasElement | null
  };

  const cropMouth = (faceLandmarks: any) => {
    if (!faceLandmarks) return null;
    const box = getLandmarksBoundingBox(faceLandmarks, MOUTH_INDICES, width, height, 0.3);
    const canvas = cropPart(box);
    applyFeatherBox(canvas, Math.max(3, Math.floor(canvas.width * 0.15)));
    return canvas;
  };

  if (is3x3) {
    // 3x3グリッド配置：あいうえお口形に対応
    // Cell 2 (右上) = あ, Cell 3 (中左) = い, Cell 4 (中央) = う, Cell 5 (中右) = え, Cell 6 (下左) = お
    openMouths.a = cropMouth(faceMap[2]);
    openMouths.i = cropMouth(faceMap[3]);
    openMouths.u = cropMouth(faceMap[4]);
    openMouths.e = cropMouth(faceMap[5]);
    openMouths.o = cropMouth(faceMap[6]);
  } else {
    // 2x2グリッド配置：Cell 2 (左下) の共通口パーツを全母音に割り当て
    const singleOpenMouth = cropMouth(faceMap[2]);
    openMouths.a = singleOpenMouth;
    openMouths.i = singleOpenMouth;
    openMouths.u = singleOpenMouth;
    openMouths.e = singleOpenMouth;
    openMouths.o = singleOpenMouth;
  }

  // 7. ベース顔側での各パーツ位置（クアドラント基準の相対座標へ変換するため）
  const baseLeftEyeBox = getLandmarksBoundingBox(baseFace, LEFT_EYE_INDICES, width, height, 0.35);
  const baseRightEyeBox = getLandmarksBoundingBox(baseFace, RIGHT_EYE_INDICES, width, height, 0.35);
  const baseMouthBox = getLandmarksBoundingBox(baseFace, MOUTH_INDICES, width, height, 0.3);

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
    openMouth: openMouths.a, // 後方互換性用
    openMouths,
    baseFaceQuad,
    baseLeftEyeRect: toQuadRect(baseLeftEyeBox),
    baseRightEyeRect: toQuadRect(baseRightEyeBox),
    baseMouthRect: toQuadRect(baseMouthBox)
  };
};

const applyFeatherBox = (canvas: HTMLCanvasElement, featherPx: number = 6) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const w = canvas.width;
  const h = canvas.height;
  
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const mCtx = mask.getContext('2d');
  if (!mCtx) return;
  
  mCtx.fillStyle = 'rgba(255,255,255,1)';
  mCtx.fillRect(0, 0, w, h);
  
  mCtx.globalCompositeOperation = 'destination-out';
  
  // 左端のフェザー
  let grad = mCtx.createLinearGradient(0, 0, featherPx, 0);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mCtx.fillStyle = grad;
  mCtx.fillRect(0, 0, featherPx, h);
  
  // 右端のフェザー
  grad = mCtx.createLinearGradient(w, 0, w - featherPx, 0);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mCtx.fillStyle = grad;
  mCtx.fillRect(w - featherPx, 0, featherPx, h);
  
  // 上端のフェザー
  grad = mCtx.createLinearGradient(0, 0, 0, featherPx);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mCtx.fillStyle = grad;
  mCtx.fillRect(0, 0, w, featherPx);
  
  // 下端のフェザー
  grad = mCtx.createLinearGradient(0, h, 0, h - featherPx);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mCtx.fillStyle = grad;
  mCtx.fillRect(0, h - featherPx, w, featherPx);
  
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
};
