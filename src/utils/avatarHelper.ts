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

  // 最低1つの顔（ベース顔）が見つかればOKとする
  if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
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

  // ベース顔は最初に検出された顔（左上セルにあることを前提）
  const baseFace = multiFaceLandmarks[0];

  // 3x3グリッドとみなしてセルサイズを計算
  const gridCount = 3;
  const cellSizeW = width / gridCount;
  const cellSizeH = height / gridCount;

  const baseFaceQuad = {
    left: 0,
    top: 0,
    width: Math.floor(cellSizeW),
    height: Math.floor(cellSizeH)
  };

  // 2. 左上セルの中での目と口の相対座標を取得
  const baseLeftEyeBox = getLandmarksBoundingBox(baseFace, LEFT_EYE_INDICES, width, height, 0.35);
  const baseRightEyeBox = getLandmarksBoundingBox(baseFace, RIGHT_EYE_INDICES, width, height, 0.35);
  const baseMouthBox = getLandmarksBoundingBox(baseFace, MOUTH_INDICES, width, height, 0.3);

  // 3. 指定されたセル(col, row)から、ベース顔と全く同じ相対位置のBounding Boxを切り出す関数
  const cropFromCell = (col: number, row: number, baseBox: any) => {
    // 左上セルの左端からの相対距離（baseBoxが画像全体の絶対座標として返ってきている前提）
    const relLeft = baseBox.left; 
    const relTop = baseBox.top;
    
    // 切り出したいセルにおける絶対座標
    const targetLeft = Math.floor(col * cellSizeW) + relLeft;
    const targetTop = Math.floor(row * cellSizeH) + relTop;
    
    const c = document.createElement('canvas');
    c.width = baseBox.width;
    c.height = baseBox.height;
    const cCtx = c.getContext('2d');
    if (cCtx) {
      cCtx.drawImage(
        baseCanvas, 
        targetLeft, targetTop, baseBox.width, baseBox.height, 
        0, 0, baseBox.width, baseBox.height
      );
    }
    applyFeatherBox(c, Math.max(3, Math.floor(c.width * 0.15)));
    return c;
  };

  // 4. まばたきパーツ切り出し (Row:0, Col:1)
  const closedLeftEye = cropFromCell(1, 0, baseLeftEyeBox);
  const closedRightEye = cropFromCell(1, 0, baseRightEyeBox);

  // 5. 口パーツ切り出し
  const openMouths = {
    a: cropFromCell(0, 1, baseMouthBox), // Row:1, Col:0
    i: cropFromCell(1, 1, baseMouthBox), // Row:1, Col:1
    u: cropFromCell(2, 1, baseMouthBox), // Row:1, Col:2
    e: cropFromCell(0, 2, baseMouthBox), // Row:2, Col:0
    o: cropFromCell(1, 2, baseMouthBox)  // Row:2, Col:1
  };

  const toQuadRect = (box: any) => {
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height
    };
  };

  return {
    closedLeftEye,
    closedRightEye,
    openMouth: openMouths.a,
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
