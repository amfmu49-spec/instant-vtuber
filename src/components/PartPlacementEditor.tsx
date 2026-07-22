import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Play, RotateCcw, Scissors, MapPin, Maximize2, X, Check, Sliders, ZoomIn } from 'lucide-react';

interface Box { x: number; y: number; width: number; height: number; }

type CropKey = 'eyesOpenCrop' | 'eyesClosedCrop' | 'mouthOpenCrop' | 'mouthClosedCrop';
type PlaceKey = 'eyesPlace' | 'mouthPlace';
type ActiveKey = CropKey | PlaceKey | null;

type DragHandle = 'move' | 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

interface EditorState {
  eyesOpenCrop: Box;
  eyesClosedCrop: Box;
  mouthOpenCrop: Box;
  mouthClosedCrop: Box;
  eyesPlace: Box;
  mouthPlace: Box;
}

const COLORS: Record<string, string> = {
  eyesOpenCrop:   '#6366f1',
  eyesClosedCrop: '#8b5cf6',
  mouthOpenCrop:  '#ec4899',
  mouthClosedCrop:'#f43f5e',
  eyesPlace:  '#10b981',
  mouthPlace: '#f59e0b',
};

const LABELS: Record<string, string> = {
  eyesOpenCrop:   '✂ 開眼',
  eyesClosedCrop: '✂ 閉眼',
  mouthOpenCrop:  '✂ 開口',
  mouthClosedCrop:'✂ 閉口',
  eyesPlace:  '📍 目（両目）位置',
  mouthPlace: '📍 口 位置',
};

const DEFAULT_STATE: EditorState = {
  eyesOpenCrop:   { x: 0.0,  y: 0.0,  width: 0.5,  height: 0.5  },
  eyesClosedCrop: { x: 0.5,  y: 0.0,  width: 0.5,  height: 0.5  },
  mouthOpenCrop:  { x: 0.0,  y: 0.5,  width: 0.5,  height: 0.5  },
  mouthClosedCrop:{ x: 0.5,  y: 0.5,  width: 0.5,  height: 0.5  },
  eyesPlace:  { x: 0.15, y: 0.26, width: 0.70, height: 0.24 },
  mouthPlace: { x: 0.25, y: 0.53, width: 0.50, height: 0.18 },
};

// ─────────────────────────────────────────────
// Inner editor canvas component
// ─────────────────────────────────────────────
const EditorCanvas: React.FC<{
  state: EditorState;
  setState: React.Dispatch<React.SetStateAction<EditorState>>;
  mode: 'crop' | 'place';
  active: ActiveKey;
  setActive: (k: ActiveKey) => void;
  sheetImg: HTMLImageElement | null;
  baseImg: HTMLImageElement | null;
  removeWhiteBg: boolean;
  whiteThreshold: number;
  zoomScale: number;
  isFullscreen?: boolean;
}> = ({ state, setState, mode, active, setActive, sheetImg, baseImg, removeWhiteBg, whiteThreshold, zoomScale, isFullscreen }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawBoundsRef = useRef<{ drawX: number; drawY: number; drawW: number; drawH: number }>({
    drawX: 0, drawY: 0, drawW: 1280, drawH: 720
  });

  const dragRef = useRef<{
    key: NonNullable<ActiveKey>; handle: DragHandle;
    startMX: number; startMY: number; startBox: Box;
  } | null>(null);

  const visibleKeys: ActiveKey[] = mode === 'crop'
    ? (active ? [active] : [])
    : ['eyesPlace', 'mouthPlace'];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    // Checkerboard background
    ctx.clearRect(0, 0, cw, ch);
    for (let ty = 0; ty < ch; ty += 16)
      for (let tx = 0; tx < cw; tx += 16) {
        ctx.fillStyle = ((Math.floor(tx/16)+Math.floor(ty/16))%2===0) ? '#374151':'#1f2937';
        ctx.fillRect(tx, ty, 16, 16);
      }

    // Calculate aspect-ratio-preserved bounds for half-sheet
    let drawW = cw;
    let drawH = ch;
    let drawX = 0;
    let drawY = 0;

    if (sheetImg) {
      const sw = sheetImg.naturalWidth || sheetImg.width;
      const sh = sheetImg.naturalHeight || sheetImg.height;
      const sourceW = sw / 2;
      const sourceH = sh;
      const sourceAspect = sourceW / sourceH;
      const canvasAspect = cw / ch;

      if (canvasAspect > sourceAspect) {
        drawH = ch;
        drawW = ch * sourceAspect;
        drawX = (cw - drawW) / 2;
        drawY = 0;
      } else {
        drawW = cw;
        drawH = cw / sourceAspect;
        drawX = 0;
        drawY = (ch - drawH) / 2;
      }

      drawBoundsRef.current = { drawX, drawY, drawW, drawH };

      // Apply zoom transformation around active box or canvas center
      ctx.save();
      if (zoomScale > 1.0) {
        let focusX = cw / 2;
        let focusY = ch / 2;
        if (active) {
          const curBox = state[active as keyof EditorState] as Box;
          if (curBox) {
            focusX = drawX + (curBox.x + curBox.width / 2) * drawW;
            focusY = drawY + (curBox.y + curBox.height / 2) * drawH;
          }
        }
        ctx.translate(focusX, focusY);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-focusX, -focusY);
      }

      if (mode === 'crop') {
        // Draw RIGHT HALF of sheet (Parts) un-stretched
        ctx.drawImage(sheetImg, sw / 2, 0, sw / 2, sh, drawX, drawY, drawW, drawH);
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 13px system-ui';
        ctx.fillText('✂ パーツ切り抜きエリア (右側半分)', drawX + 8, drawY + 22);
        ctx.restore();
      } else {
        // Draw LEFT HALF of sheet (Base Bust) un-stretched
        ctx.drawImage(sheetImg, 0, 0, sw / 2, sh, drawX, drawY, drawW, drawH);
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 13px system-ui';
        ctx.fillText('📍 貼り付け位置指定 (左側素体)', drawX + 8, drawY + 22);
        ctx.restore();

        // ── LIVE RENDER CROPPED PARTS ON FACE ──
        // Render eyesOpen cropped image inside eyesPlace box
        const eCrop = state.eyesOpenCrop;
        const eSx = sw / 2 + eCrop.x * (sw / 2);
        const eSy = eCrop.y * sh;
        const eSw = Math.max(1, eCrop.width * (sw / 2));
        const eSh = Math.max(1, eCrop.height * sh);

        const eBox = state.eyesPlace;
        const eDx = drawX + eBox.x * drawW;
        const eDy = drawY + eBox.y * drawH;
        const eDw = eBox.width * drawW;
        const eDh = eBox.height * drawH;

        const tempEyes = document.createElement('canvas');
        tempEyes.width = Math.max(1, Math.round(eSw));
        tempEyes.height = Math.max(1, Math.round(eSh));
        const tCtx = tempEyes.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(sheetImg, eSx, eSy, eSw, eSh, 0, 0, tempEyes.width, tempEyes.height);
          if (removeWhiteBg) {
            const imgData = tCtx.getImageData(0, 0, tempEyes.width, tempEyes.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
                d[i + 3] = 0;
              }
            }
            tCtx.putImageData(imgData, 0, 0);
          }
          ctx.save();
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tempEyes, eDx, eDy, eDw, eDh);
          ctx.restore();
        }

        // Render mouthOpen cropped image inside mouthPlace box
        const mCrop = state.mouthOpenCrop;
        const mSx = sw / 2 + mCrop.x * (sw / 2);
        const mSy = mCrop.y * sh;
        const mSw = Math.max(1, mCrop.width * (sw / 2));
        const mSh = Math.max(1, mCrop.height * sh);

        const mBox = state.mouthPlace;
        const mDx = drawX + mBox.x * drawW;
        const mDy = drawY + mBox.y * drawH;
        const mDw = mBox.width * drawW;
        const mDh = mBox.height * drawH;

        const tempMouth = document.createElement('canvas');
        tempMouth.width = Math.max(1, Math.round(mSw));
        tempMouth.height = Math.max(1, Math.round(mSh));
        const tmCtx = tempMouth.getContext('2d');
        if (tmCtx) {
          tmCtx.drawImage(sheetImg, mSx, mSy, mSw, mSh, 0, 0, tempMouth.width, tempMouth.height);
          if (removeWhiteBg) {
            const imgData = tmCtx.getImageData(0, 0, tempMouth.width, tempMouth.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
                d[i + 3] = 0;
              }
            }
            tmCtx.putImageData(imgData, 0, 0);
          }
          ctx.save();
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tempMouth, mDx, mDy, mDw, mDh);
          ctx.restore();
        }
      }

      // Draw box overlays, borders, badges, and 8 handles for visible keys
      for (const key of visibleKeys) {
        if (!key) continue;
        const box = state[key as keyof EditorState] as Box;
        const isAct = active === key;

        const bx = drawX + box.x * drawW;
        const by = drawY + box.y * drawH;
        const bw = box.width * drawW;
        const bh = box.height * drawH;
        const color = COLORS[key];

        // Box inner fill
        ctx.save();
        ctx.globalAlpha = isAct ? 0.18 : 0.08;
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();

        // Border line
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = isAct ? 2.5 : 1.5;
        ctx.setLineDash(isAct ? [] : [5, 4]);
        ctx.globalAlpha = isAct ? 1 : 0.6;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();

        // Badge label
        const label = LABELS[key];
        ctx.save();
        ctx.font = `bold ${isAct ? 12 : 10}px system-ui`;
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(bx, Math.max(0, by - 18), tw, 17);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(label, bx + 4, Math.max(12, by - 5));
        ctx.restore();

        // 8 Handles for active box
        if (isAct) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;

          const handles = [
            { x: bx, y: by, type: 'corner' },
            { x: bx + bw, y: by, type: 'corner' },
            { x: bx, y: by + bh, type: 'corner' },
            { x: bx + bw, y: by + bh, type: 'corner' },
            { x: bx + bw / 2, y: by, type: 'edgeH' },
            { x: bx + bw / 2, y: by + bh, type: 'edgeH' },
            { x: bx, y: by + bh / 2, type: 'edgeV' },
            { x: bx + bw, y: by + bh / 2, type: 'edgeV' },
          ];

          for (const h of handles) {
            if (h.type === 'corner') {
              ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
              ctx.strokeRect(h.x - 5, h.y - 5, 10, 10);
            } else if (h.type === 'edgeH') {
              ctx.fillRect(h.x - 14, h.y - 4, 28, 8);
              ctx.strokeRect(h.x - 14, h.y - 4, 28, 8);
            } else if (h.type === 'edgeV') {
              ctx.fillRect(h.x - 4, h.y - 14, 8, 28);
              ctx.strokeRect(h.x - 4, h.y - 14, 8, 28);
            }
          }
          ctx.restore();
        }
      }

      ctx.restore(); // Restore zoom transform
    }
  }, [state, active, mode, sheetImg, baseImg, removeWhiteBg, whiteThreshold, zoomScale, visibleKeys]);

  useEffect(() => { draw(); }, [draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    let cx = 0, cy = 0;
    if ('touches' in e) {
      cx = (e.touches[0].clientX - r.left) * sx;
      cy = (e.touches[0].clientY - r.top) * sy;
    } else {
      cx = (e.clientX - r.left) * sx;
      cy = (e.clientY - r.top) * sy;
    }

    // Inverse transform for zoom Scale
    if (zoomScale > 1.0) {
      const { drawX, drawY, drawW, drawH } = drawBoundsRef.current;
      let focusX = c.width / 2;
      let focusY = c.height / 2;
      if (active) {
        const curBox = state[active as keyof EditorState] as Box;
        if (curBox) {
          focusX = drawX + (curBox.x + curBox.width / 2) * drawW;
          focusY = drawY + (curBox.y + curBox.height / 2) * drawH;
        }
      }
      cx = focusX + (cx - focusX) / zoomScale;
      cy = focusY + (cy - focusY) / zoomScale;
    }

    return { cx, cy };
  };

  const hitTest = (cx: number, cy: number): { key: NonNullable<ActiveKey>; handle: DragHandle } => {
    const { drawX, drawY, drawW, drawH } = drawBoundsRef.current;

    // 1. Check handles on current active box
    if (active) {
      const activeBox = state[active as keyof EditorState] as Box;
      if (activeBox) {
        const abx = drawX + activeBox.x * drawW;
        const aby = drawY + activeBox.y * drawH;
        const abw = activeBox.width * drawW;
        const abh = activeBox.height * drawH;
        const tol = 24;

        if (Math.abs(cy - aby) <= tol && cx >= abx + 10 && cx <= abx + abw - 10) return { key: active, handle: 'n' };
        if (Math.abs(cy - (aby + abh)) <= tol && cx >= abx + 10 && cx <= abx + abw - 10) return { key: active, handle: 's' };
        if (Math.abs(cx - abx) <= tol && cy >= aby + 10 && cy <= aby + abh - 10) return { key: active, handle: 'w' };
        if (Math.abs(cx - (abx + abw)) <= tol && cy >= aby + 10 && cy <= aby + abh - 10) return { key: active, handle: 'e' };

        if (Math.abs(cx - abx) <= tol && Math.abs(cy - aby) <= tol) return { key: active, handle: 'nw' };
        if (Math.abs(cx - (abx + abw)) <= tol && Math.abs(cy - aby) <= tol) return { key: active, handle: 'ne' };
        if (Math.abs(cx - abx) <= tol && Math.abs(cy - (aby + abh)) <= tol) return { key: active, handle: 'sw' };
        if (Math.abs(cx - (abx + abw)) <= tol && Math.abs(cy - (aby + abh)) <= tol) return { key: active, handle: 'se' };
      }
    }

    // 2. Check if touching inside another visible box
    for (const key of [...visibleKeys].reverse()) {
      if (!key || key === active) continue;
      const box = state[key as keyof EditorState] as Box;
      const bx = drawX + box.x * drawW;
      const by = drawY + box.y * drawH;
      const bw = box.width * drawW;
      const bh = box.height * drawH;
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        return { key: key as NonNullable<ActiveKey>, handle: 'move' };
      }
    }

    // 3. In crop mode when active is null: detect quadrant tap to select part
    if (mode === 'crop') {
      const relX = (cx - drawX) / drawW;
      const relY = (cy - drawY) / drawH;
      let targetKey: CropKey = 'eyesOpenCrop';
      if (relX < 0.5 && relY < 0.5) targetKey = 'eyesOpenCrop';
      else if (relX >= 0.5 && relY < 0.5) targetKey = 'eyesClosedCrop';
      else if (relX < 0.5 && relY >= 0.5) targetKey = 'mouthOpenCrop';
      else targetKey = 'mouthClosedCrop';

      return { key: targetKey, handle: 'move' };
    }

    const defaultKey = active || 'eyesPlace';
    return { key: defaultKey as NonNullable<ActiveKey>, handle: 'move' };
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const {cx,cy} = getCoords(e);
    const hit = hitTest(cx, cy);
    setActive(hit.key);
    dragRef.current = { key: hit.key, handle: hit.handle, startMX: cx, startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) } };
    e.preventDefault();
  };

  const processDrag = (cx: number, cy: number) => {
    if (!dragRef.current) return;
    const { key, handle, startMX, startMY, startBox } = dragRef.current;
    const { drawW, drawH } = drawBoundsRef.current;
    const dx = (cx - startMX) / drawW;
    const dy = (cy - startMY) / drawH;
    const minDim = 0.02;

    setState(prev => {
      let { x, y, width, height } = startBox;
      if (handle === 'move') {
        x = Math.max(0, Math.min(1 - width, startBox.x + dx));
        y = Math.max(0, Math.min(1 - height, startBox.y + dy));
      } else {
        if (handle === 'n' || handle === 'nw' || handle === 'ne') {
          const newY = Math.max(0, Math.min(startBox.y + startBox.height - minDim, startBox.y + dy));
          height = startBox.height - (newY - startBox.y);
          y = newY;
        }
        if (handle === 's' || handle === 'sw' || handle === 'se') {
          height = Math.max(minDim, Math.min(1 - startBox.y, startBox.height + dy));
        }
        if (handle === 'w' || handle === 'nw' || handle === 'sw') {
          const newX = Math.max(0, Math.min(startBox.x + startBox.width - minDim, startBox.x + dx));
          width = startBox.width - (newX - startBox.x);
          x = newX;
        }
        if (handle === 'e' || handle === 'ne' || handle === 'se') {
          width = Math.max(minDim, Math.min(1 - startBox.x, startBox.width + dx));
        }
      }
      return { ...prev, [key]: { x, y, width, height } };
    });
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { cx, cy } = getCoords(e);
    processDrag(cx, cy);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { cx, cy } = getCoords(e);
    processDrag(cx, cy);
    e.preventDefault();
  };

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const {cx,cy} = getCoords(e);
    const hit = hitTest(cx, cy);
    setActive(hit.key);
    dragRef.current = { key: hit.key, handle: hit.handle, startMX: cx, startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) } };
    e.preventDefault();
  };

  const onUp = () => { dragRef.current = null; };

  const CW = 1280, CH = 720;

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      style={{
        width: '100%',
        height: isFullscreen ? '100%' : undefined,
        maxHeight: isFullscreen ? '100%' : undefined,
        display: 'block',
        cursor: dragRef.current ? 'grabbing' : 'crosshair',
        userSelect: 'none',
        touchAction: 'none',
        objectFit: 'contain',
      }}
    />
  );
};

// ─────────────────────────────────────────────
// Main exported PartPlacementEditor component
// ─────────────────────────────────────────────
export const PartPlacementEditor: React.FC = () => {
  const {
    parsedAssetSheetParts,
    setAvatarCoords,
    setParsedAssetSheetParts,
    whiteThreshold,
    setWhiteThreshold,
    removeWhiteBg,
    setRemoveWhiteBg,
  } = useAppContext();

  const navigate = useNavigate();

  const [mode, setMode] = useState<'crop' | 'place'>('crop');
  const [active, setActive] = useState<ActiveKey>(null);
  const [state, setState] = useState<EditorState>(DEFAULT_STATE);
  const [fullscreen, setFullscreen] = useState(true);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const sheetImgRef = useRef<HTMLImageElement | null>(null);
  const baseImgRef  = useRef<HTMLImageElement | null>(null);
  const [, forceRedraw] = useState(0);

  useEffect(() => {
    if (!parsedAssetSheetParts) return;
    const loadImg = (src: string) => {
      const img = new Image(); img.src = src;
      return img;
    };
    if (parsedAssetSheetParts._originalSheetDataUrl) {
      sheetImgRef.current = loadImg(parsedAssetSheetParts._originalSheetDataUrl);
      sheetImgRef.current.onload = () => forceRedraw(n => n + 1);
    } else if (parsedAssetSheetParts.baseBustDataUrl) {
      sheetImgRef.current = loadImg(parsedAssetSheetParts.baseBustDataUrl);
      sheetImgRef.current.onload = () => forceRedraw(n => n + 1);
    }
    if (parsedAssetSheetParts.baseBustDataUrl) {
      baseImgRef.current = loadImg(parsedAssetSheetParts._originalSheetDataUrl || parsedAssetSheetParts.baseBustDataUrl);
      baseImgRef.current.onload = () => forceRedraw(n => n + 1);
    }
  }, [parsedAssetSheetParts]);

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [fullscreen]);

  const applyManualCrops = () => {
    const img = sheetImgRef.current;
    if (!parsedAssetSheetParts || !img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const halfW = iw / 2;

    const crop = (box: Box) => {
      const c = document.createElement('canvas');
      const cw = Math.max(1, Math.round(box.width * halfW));
      const ch = Math.max(1, Math.round(box.height * ih));
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext('2d');
      if (!ctx) return c.toDataURL();

      ctx.drawImage(img,
        halfW + box.x * halfW, box.y * ih,
        box.width * halfW, box.height * ih,
        0, 0, cw, ch);

      if (removeWhiteBg) {
        const imgData = ctx.getImageData(0, 0, cw, ch);
        const d = imgData.data;
        const thresh = whiteThreshold;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= thresh && d[i + 1] >= thresh && d[i + 2] >= thresh) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      return c.toDataURL();
    };

    setParsedAssetSheetParts({
      ...parsedAssetSheetParts,
      eyesOpenDataUrl:   crop(state.eyesOpenCrop),
      eyesClosedDataUrl: crop(state.eyesClosedCrop),
      mouthOpenDataUrl:  crop(state.mouthOpenCrop),
      mouthClosedDataUrl:crop(state.mouthClosedCrop),
    });
  };

  const handleConfirm = () => {
    applyManualCrops();
    setAvatarCoords({
      leftEye: null,
      rightEye: null,
      mouth: state.mouthPlace,
      mouthState: 'closed',
      eyeState: 'open',
      neckY: 85,
      neckX: 50,
      removeWhiteBg: removeWhiteBg,
      eyesBox: state.eyesPlace,
    } as any);
    setFullscreen(false);
    navigate('/main');
  };

  const switchMode = (m: 'crop' | 'place') => {
    setMode(m);
    setActive(m === 'crop' ? null : 'eyesPlace');
  };

  if (!parsedAssetSheetParts) return null;

  const visibleKeys: ActiveKey[] = mode === 'crop'
    ? (active ? [active] : [])
    : ['eyesPlace', 'mouthPlace'];

  const cropButtons: CropKey[] = ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'];

  const canvasProps = {
    state, setState, mode, active, setActive,
    sheetImg: sheetImgRef.current,
    baseImg: baseImgRef.current,
    removeWhiteBg,
    whiteThreshold,
    zoomScale,
  };

  const curBox = active ? (state[active as keyof EditorState] as Box) : null;

  const setSymmetricWidth = (newW: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerX = b.x + b.width / 2;
      const newX = Math.max(0, Math.min(1 - newW, centerX - newW / 2));
      return { ...prev, [active]: { ...b, x: newX, width: newW } };
    });
  };

  const setSymmetricHeight = (newH: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerY = b.y + b.height / 2;
      const newY = Math.max(0, Math.min(1 - newH, centerY - newH / 2));
      return { ...prev, [active]: { ...b, y: newY, height: newH } };
    });
  };

  const setCenterX = (newCX: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const newX = Math.max(0, Math.min(1 - b.width, newCX - b.width / 2));
      return { ...prev, [active]: { ...b, x: newX } };
    });
  };

  const setCenterY = (newCY: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const newY = Math.max(0, Math.min(1 - b.height, newCY - b.height / 2));
      return { ...prev, [active]: { ...b, y: newY } };
    });
  };

  const curCenterX = curBox ? (curBox.x + curBox.width / 2) : 0.5;
  const curCenterY = curBox ? (curBox.y + curBox.height / 2) : 0.5;

  // ─ FULLSCREEN OVERLAY ─
  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none',
      }}>

        {/* ── ROW 1: Mode tabs + Zoom slider + Transparency + Confirm/Close ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          background: 'rgba(15,23,42,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <button onClick={() => switchMode('crop')} style={{
            padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
            border: `2px solid ${mode==='crop'?'#6366f1':'rgba(255,255,255,0.1)'}`,
            background: mode==='crop'?'rgba(99,102,241,0.3)':'transparent',
            color: mode==='crop'?'#a5b4fc':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}><Scissors size={14}/> 1. 切り抜き</button>

          <button onClick={() => switchMode('place')} style={{
            padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
            border: `2px solid ${mode==='place'?'#10b981':'rgba(255,255,255,0.1)'}`,
            background: mode==='place'?'rgba(16,185,129,0.3)':'transparent',
            color: mode==='place'?'#6ee7b7':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}><MapPin size={14}/> 2. 貼り付け</button>

          {/* Integrated Zoom Slider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(0,0,0,0.35)', padding: '0.25rem 0.5rem',
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <ZoomIn size={13} color="#60a5fa" />
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>拡大: {zoomScale.toFixed(1)}x</span>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={zoomScale}
              onChange={(e) => setZoomScale(Number(e.target.value))}
              style={{ width: '65px', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            {zoomScale > 1.0 && (
              <button onClick={() => setZoomScale(1.0)} style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1',
                borderRadius: '4px', fontSize: '0.65rem', padding: '0.1rem 0.35rem', cursor: 'pointer',
              }}>1.0x</button>
            )}
          </div>

          {/* Integrated Transparency Slider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(0,0,0,0.35)', padding: '0.25rem 0.5rem',
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Sliders size={13} color="#c084fc" />
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>透過: {whiteThreshold}</span>
            <input
              type="range"
              min="180"
              max="255"
              step="1"
              value={whiteThreshold}
              onChange={(e) => setWhiteThreshold(Number(e.target.value))}
              style={{ width: '65px', accentColor: '#a855f7', cursor: 'pointer' }}
            />
            <label style={{ fontSize: '0.72rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={removeWhiteBg}
                onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                style={{ accentColor: '#a855f7' }}
              />
              白透過
            </label>
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={() => setState(DEFAULT_STATE)} style={{
            padding: '0.35rem 0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem',
          }}><RotateCcw size={13}/></button>

          <button onClick={() => setFullscreen(false)} style={{
            padding: '0.35rem 0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.78rem',
          }}><X size={14}/></button>

          <button onClick={handleConfirm} style={{
            padding: '0.35rem 0.85rem', borderRadius: '8px',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            boxShadow: '0 3px 12px rgba(16,185,129,0.4)'
          }}><Check size={14}/> 確定</button>
        </div>

        {/* ── ROW 2: Part selector pills ── */}
        <div style={{
          display: 'flex', gap: '0.3rem', padding: '0.3rem 0.6rem',
          background: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          overflowX: 'auto',
        }}>
          {mode === 'crop' ? (
            cropButtons.map(key => (
              <button key={key} onClick={() => setActive(key)} style={{
                padding: '0.2rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem',
                border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.1)'}`,
                background: active===key ? `${COLORS[key]}30` : 'transparent',
                color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:400,
                whiteSpace: 'nowrap',
              }}>{LABELS[key]}</button>
            ))
          ) : (
            (['eyesPlace', 'mouthPlace'] as PlaceKey[]).map(key => (
              <button key={key} onClick={() => setActive(key)} style={{
                padding: '0.2rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem',
                border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.1)'}`,
                background: active===key ? `${COLORS[key]}30` : 'transparent',
                color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:400,
                whiteSpace: 'nowrap',
              }}>{LABELS[key]}</button>
            ))
          )}
        </div>

        {/* ── Canvas area ── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '2px',
        }}>
          <EditorCanvas {...canvasProps} isFullscreen />
        </div>

        {/* ── Bottom sliders ── */}
        <div style={{
          background: 'rgba(15,23,42,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          padding: '0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 16px)) 0.75rem',
          flexShrink: 0,
          zIndex: 10000,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}>
          {active && curBox ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.8rem' }}>
              {/* 横幅（左右狭まる） */}
              <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
                <span style={{ fontSize:'0.7rem', color: COLORS[active], fontWeight: 600 }}>
                  ↔ 横幅 (左右から伸縮): {(curBox.width * 100).toFixed(1)}%
                </span>
                <input type="range"
                  min="0.02" max="0.95" step="0.005"
                  value={curBox.width}
                  onChange={e => setSymmetricWidth(Number(e.target.value))}
                  style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%' }}
                />
              </label>

              {/* 縦幅（上下狭まる） */}
              <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
                <span style={{ fontSize:'0.7rem', color: COLORS[active], fontWeight: 600 }}>
                  ↕ 縦幅 (上下から伸縮): {(curBox.height * 100).toFixed(1)}%
                </span>
                <input type="range"
                  min="0.02" max="0.95" step="0.005"
                  value={curBox.height}
                  onChange={e => setSymmetricHeight(Number(e.target.value))}
                  style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%' }}
                />
              </label>

              {/* X位置 */}
              <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
                <span style={{ fontSize:'0.7rem', color: '#94a3b8' }}>
                  X位置 (中心): {(curCenterX * 100).toFixed(1)}%
                </span>
                <input type="range"
                  min="0" max="1" step="0.005"
                  value={curCenterX}
                  onChange={e => setCenterX(Number(e.target.value))}
                  style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%' }}
                />
              </label>

              {/* Y位置 */}
              <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
                <span style={{ fontSize:'0.7rem', color: '#94a3b8' }}>
                  Y位置 (中心): {(curCenterY * 100).toFixed(1)}%
                </span>
                <input type="range"
                  min="0" max="1" step="0.005"
                  value={curCenterY}
                  onChange={e => setCenterY(Number(e.target.value))}
                  style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%' }}
                />
              </label>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '0.2rem' }}>
              👆 上のパーツボタン（✂ 開眼 など）または画像上のパーツ領域をタップして指定を始めてください
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
      <button
        onClick={() => setFullscreen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
          padding: '0.85rem',
          borderRadius: '12px',
          border: '2px solid rgba(99,102,241,0.5)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
          color: '#c4b5fd',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99,102,241,0.25)',
        }}
      >
        <Maximize2 size={22} />
        📱 フルスクリーンエディターで編集する
      </button>

      <button
        onClick={handleConfirm}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', border: 'none',
          padding: '0.8rem 2rem', borderRadius: '12px',
          fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        <Play size={18} fill="#fff" />
        この配置で確定してWebCamトラッキング開始 🎬
      </button>
    </div>
  );
};

export default PartPlacementEditor;
