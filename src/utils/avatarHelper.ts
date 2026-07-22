import type { PsdLayerData } from '../store/AppContext';

export const splitImageIntoHeadAndBody = (
  img: HTMLImageElement,
  neckYPercent: number, // 0 to 100
  removeWhiteBg: boolean = true,
  isGrid3x3: boolean = false
): PsdLayerData[] => {
  let sourceCanvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;
  
  if (isGrid3x3) {
    width = img.width / 3;
    height = img.height / 3;
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sCtx = sourceCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(img, 0, 0, width, height, 0, 0, width, height);
    }
  } else {
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sCtx = sourceCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(img, 0, 0);
    }
  }

  // 1. Create transparent base canvas
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return [];
  
  baseCtx.drawImage(sourceCanvas, 0, 0);
  
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

export interface Parsed16by9AssetSheet {
  baseBustCanvas: HTMLCanvasElement;
  baseBustDataUrl: string;
  eyesOpenCanvas: HTMLCanvasElement;
  eyesClosedCanvas: HTMLCanvasElement;
  leftEyeOpenCanvas: HTMLCanvasElement;
  rightEyeOpenCanvas: HTMLCanvasElement;
  leftEyeClosedCanvas: HTMLCanvasElement;
  rightEyeClosedCanvas: HTMLCanvasElement;
  mouthOpenCanvas: HTMLCanvasElement;
  mouthClosedCanvas: HTMLCanvasElement;
  eyesOpenDataUrl: string;
  eyesClosedDataUrl: string;
  leftEyeOpenDataUrl: string;
  rightEyeOpenDataUrl: string;
  leftEyeClosedDataUrl: string;
  rightEyeClosedDataUrl: string;
  mouthOpenDataUrl: string;
  mouthClosedDataUrl: string;
  suggestedCoords: {
    leftEye: { x: number; y: number; width: number; height: number };
    rightEye: { x: number; y: number; width: number; height: number };
    bothEyes: { x: number; y: number; width: number; height: number };
    mouth: { x: number; y: number; width: number; height: number };
  };
}

export const autotrimCanvas = (
  sourceCanvas: HTMLCanvasElement,
  removeWhite: boolean = true
): HTMLCanvasElement => {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const isWhite = removeWhite && (r > 235 && g > 235 && b > 235);
      const isOpaque = a > 20 && !isWhite;

      if (isOpaque) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return sourceCanvas;
  }

  const pad = 4;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return sourceCanvas;

  outCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  if (removeWhite) {
    const trimmedData = outCtx.getImageData(0, 0, cropW, cropH);
    const tData = trimmedData.data;
    for (let i = 0; i < tData.length; i += 4) {
      if (tData[i] > 235 && tData[i + 1] > 235 && tData[i + 2] > 235) {
        tData[i + 3] = 0;
      }
    }
    outCtx.putImageData(trimmedData, 0, 0);
  }

  return outCanvas;
};

// スマート目間ギャップ（ピクセル密度解析）自動分離関数
const splitEyeQuadrantIntoLeftAndRight = (
  rawQuadrantCanvas: HTMLCanvasElement
): { leftEye: HTMLCanvasElement; rightEye: HTMLCanvasElement } => {
  const w = rawQuadrantCanvas.width;
  const h = rawQuadrantCanvas.height;
  const ctx = rawQuadrantCanvas.getContext('2d');

  if (!ctx || w < 20 || h < 20) {
    const halfW = Math.floor(w / 2);
    const c1 = document.createElement('canvas'); c1.width = halfW; c1.height = h;
    const c2 = document.createElement('canvas'); c2.width = halfW; c2.height = h;
    c1.getContext('2d')?.drawImage(rawQuadrantCanvas, 0, 0, halfW, h, 0, 0, halfW, h);
    c2.getContext('2d')?.drawImage(rawQuadrantCanvas, halfW, 0, halfW, h, 0, 0, halfW, h);
    return { leftEye: autotrimCanvas(c1), rightEye: autotrimCanvas(c2) };
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 垂直方向の不透明ピクセル密度プロファイルを計算
  const colDensity = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const isWhite = (r > 235 && g > 235 && b > 235);
      if (a > 30 && !isWhite) {
        colDensity[x]++;
      }
    }
  }

  // Xの25%〜75%の範囲で、ピクセル密度が最小となる「目の間のギャップ（谷間）」の位置を探す
  const startX = Math.floor(w * 0.25);
  const endX = Math.floor(w * 0.75);
  let minDensity = Infinity;
  let splitX = Math.floor(w / 2);

  for (let x = startX; x <= endX; x++) {
    if (colDensity[x] < minDensity) {
      minDensity = colDensity[x];
      splitX = x;
    }
  }

  // 分離キャンバスの生成
  const leftW = splitX;
  const rightW = w - splitX;

  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = leftW;
  leftCanvas.height = h;
  leftCanvas.getContext('2d')?.drawImage(rawQuadrantCanvas, 0, 0, leftW, h, 0, 0, leftW, h);

  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = rightW;
  rightCanvas.height = h;
  rightCanvas.getContext('2d')?.drawImage(rawQuadrantCanvas, splitX, 0, rightW, h, 0, 0, rightW, h);

  return {
    leftEye: autotrimCanvas(leftCanvas, true),
    rightEye: autotrimCanvas(rightCanvas, true)
  };
};

export const parse16by9AssetSheet = (img: HTMLImageElement): Parsed16by9AssetSheet => {
  const fullWidth = img.width;
  const fullHeight = img.height;

  const halfWidth = Math.floor(fullWidth / 2);

  // 1. Base Bust Canvas (0 -> 50% X)
  const baseBustCanvas = document.createElement('canvas');
  baseBustCanvas.width = halfWidth;
  baseBustCanvas.height = fullHeight;
  const baseCtx = baseBustCanvas.getContext('2d');

  if (baseCtx) {
    baseCtx.drawImage(img, 0, 0, halfWidth, fullHeight, 0, 0, halfWidth, fullHeight);
    
    // 背景の白線・背景を自動透過
    const imgData = baseCtx.getImageData(0, 0, halfWidth, fullHeight);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        data[i + 3] = 0;
      }
    }
    baseCtx.putImageData(imgData, 0, 0);
  }

  // クアドラント取得ヘルパー (Raw未トリミング)
  const extractRawQuadrant = (
    relMinX: number,
    relMaxX: number,
    relMinY: number,
    relMaxY: number
  ): HTMLCanvasElement => {
    const qX = halfWidth + Math.floor(relMinX * halfWidth);
    const qY = Math.floor(relMinY * fullHeight);
    const qW = Math.floor((relMaxX - relMinX) * halfWidth);
    const qH = Math.floor((relMaxY - relMinY) * fullHeight);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = qW;
    tempCanvas.height = qH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(img, qX, qY, qW, qH, 0, 0, qW, qH);
    }
    return tempCanvas;
  };

  // 1. 開眼クアドラント (Top-Left of Right Half: 0.0~0.5 X, 0.0~0.5 Y)
  const rawEyesOpen = extractRawQuadrant(0.0, 0.5, 0.0, 0.5);
  const eyesOpenCanvas = autotrimCanvas(rawEyesOpen, true);
  const { leftEye: leftEyeOpenCanvas, rightEye: rightEyeOpenCanvas } = splitEyeQuadrantIntoLeftAndRight(rawEyesOpen);

  // 2. 閉眼クアドラント (Top-Right of Right Half: 0.5~1.0 X, 0.0~0.5 Y)
  const rawEyesClosed = extractRawQuadrant(0.5, 1.0, 0.0, 0.5);
  const eyesClosedCanvas = autotrimCanvas(rawEyesClosed, true);
  const { leftEye: leftEyeClosedCanvas, rightEye: rightEyeClosedCanvas } = splitEyeQuadrantIntoLeftAndRight(rawEyesClosed);

  // 3. 開口クアドラント (Bottom-Left of Right Half: 0.0~0.5 X, 0.5~1.0 Y)
  const rawMouthOpen = extractRawQuadrant(0.0, 0.5, 0.5, 1.0);
  const mouthOpenCanvas = autotrimCanvas(rawMouthOpen, true);

  // 4. 閉口クアドラント (Bottom-Right of Right Half: 0.5~1.0 X, 0.5~1.0 Y)
  const rawMouthClosed = extractRawQuadrant(0.5, 1.0, 0.5, 1.0);
  const mouthClosedCanvas = autotrimCanvas(rawMouthClosed, true);

  // 推奨顔パーツ位置座標
  const suggestedCoords = {
    leftEye: { x: 0.27, y: 0.33, width: 0.17, height: 0.14 },
    rightEye: { x: 0.56, y: 0.33, width: 0.17, height: 0.14 },
    bothEyes: { x: 0.22, y: 0.28, width: 0.56, height: 0.22 },
    mouth: { x: 0.40, y: 0.53, width: 0.20, height: 0.13 }
  };

  return {
    baseBustCanvas,
    baseBustDataUrl: baseBustCanvas.toDataURL(),
    eyesOpenCanvas,
    eyesClosedCanvas,
    leftEyeOpenCanvas,
    rightEyeOpenCanvas,
    leftEyeClosedCanvas,
    rightEyeClosedCanvas,
    mouthOpenCanvas,
    mouthClosedCanvas,
    eyesOpenDataUrl: eyesOpenCanvas.toDataURL(),
    eyesClosedDataUrl: eyesClosedCanvas.toDataURL(),
    leftEyeOpenDataUrl: leftEyeOpenCanvas.toDataURL(),
    rightEyeOpenDataUrl: rightEyeOpenCanvas.toDataURL(),
    leftEyeClosedDataUrl: leftEyeClosedCanvas.toDataURL(),
    rightEyeClosedDataUrl: rightEyeClosedCanvas.toDataURL(),
    mouthOpenDataUrl: mouthOpenCanvas.toDataURL(),
    mouthClosedDataUrl: mouthClosedCanvas.toDataURL(),
    suggestedCoords
  };
};

