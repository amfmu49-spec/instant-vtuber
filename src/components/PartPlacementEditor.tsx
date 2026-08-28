import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  eyesOpenCrop:   { x: 0.0, y: 0.0, width: 0.5, height: 0.5 },
  eyesClosedCrop: { x: 0.5, y: 0.0, width: 0.5, height: 0.5 },
  mouthOpenCrop:  { x: 0.0, y: 0.5, width: 0.5, height: 0.5 },
  mouthClosedCrop:{ x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  eyesPlace:  { x: 0.325, y: 0.32, width: 0.35, height: 0.12 },
  mouthPlace: { x: 0.375, y: 0.47, width: 0.25, height: 0.09 },
};

const cropButtons: CropKey[] = ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'];

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

  const [previewEyesClosed, setPreviewEyesClosed] = useState(false);
  const [previewMouthClosed, setPreviewMouthClosed] = useState(false);

  // Preview animations: slow blinking and mouth open/closed toggling on Placement Screen
  useEffect(() => {
    if (mode !== 'place') {
      setPreviewEyesClosed(false);
      setPreviewMouthClosed(false);
      return;
    }

    // Blink: close eyes for 300ms every 3 seconds
    const blinkInterval = setInterval(() => {
      setPreviewEyesClosed(true);
      setTimeout(() => {
        setPreviewEyesClosed(false);
      }, 300);
    }, 3000);

    // Speak: toggle mouth open/closed every 1.2 seconds
    const mouthInterval = setInterval(() => {
      setPreviewMouthClosed(prev => !prev);
    }, 1200);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(mouthInterval);
    };
  }, [mode]);

  const dragRef = useRef<{
    key: NonNullable<ActiveKey>; handle: DragHandle;
    startMX: number; startMY: number; startBox: Box;
  } | null>(null);

  const croppedEyesCanvas = React.useMemo(() => {
    if (!sheetImg || mode === 'crop') return null;
    const sw = sheetImg.naturalWidth;
    const sh = sheetImg.naturalHeight;
    const eCrop = state.eyesOpenCrop;
    const eSx = sw / 2 + eCrop.x * (sw / 2);
    const eSy = eCrop.y * sh;
    const eSw = Math.max(1, eCrop.width * (sw / 2));
    const eSh = Math.max(1, eCrop.height * sh);

    const maxDim = 250;
    const rawW = Math.max(1, eSw);
    const rawH = Math.max(1, eSh);
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const cw = Math.max(1, Math.round(rawW * scale));
    const ch = Math.max(1, Math.round(rawH * scale));

    const tempEyes = document.createElement('canvas');
    tempEyes.width = cw;
    tempEyes.height = ch;
    const tCtx = tempEyes.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(sheetImg, eSx, eSy, eSw, eSh, 0, 0, cw, ch);
      if (removeWhiteBg) {
        const imgData = tCtx.getImageData(0, 0, cw, ch);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
            d[i + 3] = 0;
          }
        }
        tCtx.putImageData(imgData, 0, 0);
      }
    }
    return tempEyes;
  }, [sheetImg, mode, state.eyesOpenCrop, removeWhiteBg, whiteThreshold]);

  const croppedMouthCanvas = React.useMemo(() => {
    if (!sheetImg || mode === 'crop') return null;
    const sw = sheetImg.naturalWidth;
    const sh = sheetImg.naturalHeight;
    const mCrop = state.mouthOpenCrop;
    const mSx = sw / 2 + mCrop.x * (sw / 2);
    const mSy = mCrop.y * sh;
    const mSw = Math.max(1, mCrop.width * (sw / 2));
    const mSh = Math.max(1, mCrop.height * sh);

    const maxDim = 250;
    const rawW = Math.max(1, mSw);
    const rawH = Math.max(1, mSh);
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const cw = Math.max(1, Math.round(rawW * scale));
    const ch = Math.max(1, Math.round(rawH * scale));

    const tempMouth = document.createElement('canvas');
    tempMouth.width = cw;
    tempMouth.height = ch;
    const tmCtx = tempMouth.getContext('2d');
    if (tmCtx) {
      tmCtx.drawImage(sheetImg, mSx, mSy, mSw, mSh, 0, 0, cw, ch);
      if (removeWhiteBg) {
        const imgData = tmCtx.getImageData(0, 0, cw, ch);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
            d[i + 3] = 0;
          }
        }
        tmCtx.putImageData(imgData, 0, 0);
      }
    }
    return tempMouth;
  }, [sheetImg, mode, state.mouthOpenCrop, removeWhiteBg, whiteThreshold]);

  const croppedEyesClosedCanvas = React.useMemo(() => {
    if (!sheetImg || mode === 'crop') return null;
    const sw = sheetImg.naturalWidth;
    const sh = sheetImg.naturalHeight;
    const eCrop = state.eyesClosedCrop;
    const eSx = sw / 2 + eCrop.x * (sw / 2);
    const eSy = eCrop.y * sh;
    const eSw = Math.max(1, eCrop.width * (sw / 2));
    const eSh = Math.max(1, eCrop.height * sh);

    const maxDim = 250;
    const rawW = Math.max(1, eSw);
    const rawH = Math.max(1, eSh);
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const cw = Math.max(1, Math.round(rawW * scale));
    const ch = Math.max(1, Math.round(rawH * scale));

    const tempEyes = document.createElement('canvas');
    tempEyes.width = cw;
    tempEyes.height = ch;
    const tCtx = tempEyes.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(sheetImg, eSx, eSy, eSw, eSh, 0, 0, cw, ch);
      if (removeWhiteBg) {
        const imgData = tCtx.getImageData(0, 0, cw, ch);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
            d[i + 3] = 0;
          }
        }
        tCtx.putImageData(imgData, 0, 0);
      }
    }
    return tempEyes;
  }, [sheetImg, mode, state.eyesClosedCrop, removeWhiteBg, whiteThreshold]);

  const croppedMouthClosedCanvas = React.useMemo(() => {
    if (!sheetImg || mode === 'crop') return null;
    const sw = sheetImg.naturalWidth;
    const sh = sheetImg.naturalHeight;
    const mCrop = state.mouthClosedCrop;
    const mSx = sw / 2 + mCrop.x * (sw / 2);
    const mSy = mCrop.y * sh;
    const mSw = Math.max(1, mCrop.width * (sw / 2));
    const mSh = Math.max(1, mCrop.height * sh);

    const maxDim = 250;
    const rawW = Math.max(1, mSw);
    const rawH = Math.max(1, mSh);
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const cw = Math.max(1, Math.round(rawW * scale));
    const ch = Math.max(1, Math.round(rawH * scale));

    const tempMouth = document.createElement('canvas');
    tempMouth.width = cw;
    tempMouth.height = ch;
    const tmCtx = tempMouth.getContext('2d');
    if (tmCtx) {
      tmCtx.drawImage(sheetImg, mSx, mSy, mSw, mSh, 0, 0, cw, ch);
      if (removeWhiteBg) {
        const imgData = tmCtx.getImageData(0, 0, cw, ch);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= whiteThreshold && d[i + 1] >= whiteThreshold && d[i + 2] >= whiteThreshold) {
            d[i + 3] = 0;
          }
        }
        tmCtx.putImageData(imgData, 0, 0);
      }
    }
    return tempMouth;
  }, [sheetImg, mode, state.mouthClosedCrop, removeWhiteBg, whiteThreshold]);

  const visibleKeys = React.useMemo<ActiveKey[]>(() => mode === 'crop'
    ? (active ? [active] : ['eyesOpenCrop'])
    : ['eyesPlace', 'mouthPlace'], [mode, active]);

  // Auto-sync placement box heights with cropped canvas aspect ratios when canvases or mode change
  useEffect(() => {
    if (mode === 'place' && croppedEyesCanvas && sheetImg) {
      const aspect = croppedEyesCanvas.width / croppedEyesCanvas.height;
      setState(prev => {
        const sw = sheetImg.naturalWidth || sheetImg.width;
        const sh = sheetImg.naturalHeight || sheetImg.height;
        if (sw > 0 && sh > 0) {
          const ratio = (sw / 2) / sh;
          const nextHeight = (prev.eyesPlace.width * ratio) / aspect;
          const diff = prev.eyesPlace.height - nextHeight;
          const nextY = prev.eyesPlace.y + diff / 2; // Preserve center Y!
          if (Math.abs(prev.eyesPlace.height - nextHeight) > 0.001) {
            return {
              ...prev,
              eyesPlace: { 
                ...prev.eyesPlace, 
                y: Math.max(0, Math.min(1 - nextHeight, nextY)), 
                height: nextHeight 
              }
            };
          }
        }
        return prev;
      });
    }
  }, [mode, croppedEyesCanvas, sheetImg]);

  useEffect(() => {
    if (mode === 'place' && croppedMouthCanvas && sheetImg) {
      const aspect = croppedMouthCanvas.width / croppedMouthCanvas.height;
      setState(prev => {
        const sw = sheetImg.naturalWidth || sheetImg.width;
        const sh = sheetImg.naturalHeight || sheetImg.height;
        if (sw > 0 && sh > 0) {
          const ratio = (sw / 2) / sh;
          const nextHeight = (prev.mouthPlace.width * ratio) / aspect;
          const diff = prev.mouthPlace.height - nextHeight;
          const nextY = prev.mouthPlace.y + diff / 2; // Preserve center Y!
          if (Math.abs(prev.mouthPlace.height - nextHeight) > 0.001) {
            return {
              ...prev,
              mouthPlace: { 
                ...prev.mouthPlace, 
                y: Math.max(0, Math.min(1 - nextHeight, nextY)), 
                height: nextHeight 
              }
            };
          }
        }
        return prev;
      });
    }
  }, [mode, croppedMouthCanvas, sheetImg]);

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
      const sw = sheetImg.naturalWidth;
      const sh = sheetImg.naturalHeight;
      if (!sw || !sh) return;

      const halfW = sw / 2;
      const imgAspect = halfW / sh;
      const canvasAspect = cw / ch;

      if (imgAspect > canvasAspect) {
        drawW = cw;
        drawH = cw / imgAspect;
        drawX = 0;
        drawY = (ch - drawH) / 2;
      } else {
        drawH = ch;
        drawW = ch * imgAspect;
        drawX = (cw - drawW) / 2;
        drawY = 0;
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
      } else {
        const cx = cw / 2;
        const cy = ch / 2;
        ctx.translate(cx, cy);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-cx, -cy);
      }

      if (mode === 'crop') {
        // Draw RIGHT HALF of sheet (Parts) un-stretched in full screen
        ctx.drawImage(sheetImg, sw / 2, 0, sw / 2, sh, drawX, drawY, drawW, drawH);
        ctx.save();
        ctx.fillStyle = '#fef08a'; ctx.font = 'bold 14px system-ui';
        const partLabel = active ? LABELS[active] : '開眼';
        ctx.fillText(`✂ 画面1: 「${partLabel}」の枠合わせ中 (選択パーツのみ枠表示)`, drawX + 8, drawY + 22);
        ctx.restore();
      } else {
        // Draw LEFT HALF of sheet (Base Bust) un-stretched in full screen
        ctx.drawImage(sheetImg, 0, 0, sw / 2, sh, drawX, drawY, drawW, drawH);
        ctx.save();
        ctx.fillStyle = '#6ee7b7'; ctx.font = 'bold 14px system-ui';
        ctx.fillText('📍 画面2: 顔の位置合わせ (左側素体)', drawX + 8, drawY + 22);
        ctx.restore();

        // ── LIVE RENDER CROPPED PARTS ON FACE ──
        const activeEyesCanvas = previewEyesClosed ? (croppedEyesClosedCanvas || croppedEyesCanvas) : croppedEyesCanvas;
        if (activeEyesCanvas) {
          const eBox = state.eyesPlace;
          const aspect = activeEyesCanvas.width / activeEyesCanvas.height;
          const eDw = eBox.width * drawW;
          const eDh = eDw / aspect;
          const eDx = drawX + eBox.x * drawW + (eBox.width * drawW - eDw) / 2;
          const eDy = drawY + eBox.y * drawH + (eBox.height * drawH - eDh) / 2;
          ctx.save();
          ctx.globalAlpha = 0.95;
          ctx.drawImage(activeEyesCanvas, eDx, eDy, eDw, eDh);
          ctx.restore();
        }

        const activeMouthCanvas = previewMouthClosed ? (croppedMouthClosedCanvas || croppedMouthCanvas) : croppedMouthCanvas;
        if (activeMouthCanvas) {
          const mBox = state.mouthPlace;
          const aspect = activeMouthCanvas.width / activeMouthCanvas.height;
          const mDw = mBox.width * drawW;
          const mDh = mDw / aspect;
          const mDx = drawX + mBox.x * drawW + (mBox.width * drawW - mDw) / 2;
          const mDy = drawY + mBox.y * drawH + (mBox.height * drawH - mDh) / 2;
          ctx.save();
          ctx.globalAlpha = 0.95;
          ctx.drawImage(activeMouthCanvas, mDx, mDy, mDw, mDh);
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

        // Center crosshair for active box
        if (isAct) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.55;
          
          // Horizontal line
          ctx.beginPath();
          ctx.moveTo(bx, by + bh / 2);
          ctx.lineTo(bx + bw, by + bh / 2);
          ctx.stroke();
          
          // Vertical line
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, by);
          ctx.lineTo(bx + bw / 2, by + bh);
          ctx.stroke();
          
          ctx.restore();
        }

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
  }, [state, active, mode, sheetImg, baseImg, removeWhiteBg, whiteThreshold, zoomScale, visibleKeys, croppedEyesCanvas, croppedMouthCanvas, croppedEyesClosedCanvas, croppedMouthClosedCanvas, previewEyesClosed, previewMouthClosed]);

  useEffect(() => { try { draw(); } catch(e) { console.error('draw error:', e); } }, [draw]);

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

  const hitTest = (cx: number, cy: number): { key: NonNullable<ActiveKey>; handle: DragHandle } | null => {
    // If no part button has been clicked yet, do not start dragging
    if (!active) return null;

    const { drawX, drawY, drawW, drawH } = drawBoundsRef.current;

    // Check resize handles on the currently active box
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

    // Check if tapping inside any other visible box to switch active selection
    for (const key of visibleKeys) {
      if (!key) continue;
      const box = state[key as keyof EditorState] as Box;
      if (!box) continue;
      const bx = drawX + box.x * drawW;
      const by = drawY + box.y * drawH;
      const bw = box.width * drawW;
      const bh = box.height * drawH;

      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        return { key, handle: 'move' };
      }
    }

    // Default to moving active box
    return { key: active, handle: 'move' };
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const {cx,cy} = getCoords(e);
    const hit = hitTest(cx, cy);
    if (!hit) return;
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

        // Lock aspect ratio in Placement Mode
        if (key === 'eyesPlace' && croppedEyesCanvas) {
          const aspect = croppedEyesCanvas.width / croppedEyesCanvas.height;
          const ratio = drawW / drawH;
          height = (width * ratio) / aspect;
        } else if (key === 'mouthPlace' && croppedMouthCanvas) {
          const aspect = croppedMouthCanvas.width / croppedMouthCanvas.height;
          const ratio = drawW / drawH;
          height = (width * ratio) / aspect;
        }
      }
      const nextBox = { x, y, width, height };
      const res = { ...prev, [key]: nextBox };
      if (key === 'eyesOpenCrop') {
        res.eyesClosedCrop = { ...prev.eyesClosedCrop, width, height };
      } else if (key === 'mouthOpenCrop') {
        res.mouthClosedCrop = { ...prev.mouthClosedCrop, width, height };
      }
      return res;
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
    if (!hit) return;
    setActive(hit.key);
    dragRef.current = { key: hit.key, handle: hit.handle, startMX: cx, startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) } };
    e.preventDefault();
  };

  const onUp = () => { dragRef.current = null; };

  const maxDim = 1280;
  const rawW = sheetImg ? (sheetImg.naturalWidth || sheetImg.width) / 2 : 640;
  const rawH = sheetImg ? (sheetImg.naturalHeight || sheetImg.height) : 720;
  const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
  const CW = Math.max(100, Math.round(rawW * scale));
  const CH = Math.max(100, Math.round(rawH * scale));

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
    setBaseImage,
    whiteThreshold,
    setWhiteThreshold,
    removeWhiteBg,
    setRemoveWhiteBg,
    avatarCoords,
  } = useAppContext();

  const navigate = useNavigate();

  const [mode, setMode] = useState<'crop' | 'place'>('crop');
  const [active, setActive] = useState<ActiveKey>('eyesOpenCrop');
  const [state, setState] = useState<EditorState>(DEFAULT_STATE);
  const [fullscreen, setFullscreen] = useState(true);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const sheetImgRef = useRef<HTMLImageElement | null>(null);
  const baseImgRef  = useRef<HTMLImageElement | null>(null);
  const [, forceRedraw] = useState(0);

  // Load existing coordinates if they exist so adjustments are not lost
  useEffect(() => {
    if (avatarCoords) {
      setState(prev => {
        const next = { ...prev };
        if (avatarCoords.eyesBox) {
          next.eyesPlace = { ...avatarCoords.eyesBox };
        }
        if (avatarCoords.mouth) {
          next.mouthPlace = { ...avatarCoords.mouth };
        }
        return next;
      });
    }
  }, [avatarCoords]);

  useEffect(() => {
    if (!parsedAssetSheetParts) return;
    const handleLoad = () => forceRedraw(n => n + 1);
    
    const loadImg = (src: string) => {
      const img = new Image(); 
      img.onload = handleLoad;
      img.src = src;
      return img;
    };

    if (parsedAssetSheetParts._originalSheetDataUrl) {
      sheetImgRef.current = loadImg(parsedAssetSheetParts._originalSheetDataUrl);
    } else if (parsedAssetSheetParts.baseBustDataUrl) {
      sheetImgRef.current = loadImg(parsedAssetSheetParts.baseBustDataUrl);
    }
    
    if (parsedAssetSheetParts.baseBustDataUrl) {
      baseImgRef.current = loadImg(parsedAssetSheetParts._originalSheetDataUrl || parsedAssetSheetParts.baseBustDataUrl);
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
      eyesOpenCrop:      state.eyesOpenCrop,
      eyesClosedCrop:    state.eyesClosedCrop,
      mouthOpenCrop:     state.mouthOpenCrop,
      mouthClosedCrop:   state.mouthClosedCrop,
    });
  };

  const handleClose = () => {
    setFullscreen(false);
    setParsedAssetSheetParts(null);
  };

  const handleConfirm = () => {
    applyManualCrops();
    const bustUrl = parsedAssetSheetParts?.baseBustDataUrl;
    if (bustUrl) {
      setBaseImage(bustUrl);
    }
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

  const selectTab = (key: ActiveKey) => {
    setActive(key);
    if (key === 'eyesClosedCrop') {
      setState(prev => {
        const open = prev.eyesOpenCrop;
        return {
          ...prev,
          eyesClosedCrop: {
            x: Math.min(0.95, open.x + 0.5),
            y: open.y,
            width: open.width,
            height: open.height
          }
        };
      });
    } else if (key === 'mouthClosedCrop') {
      setState(prev => {
        const open = prev.mouthOpenCrop;
        return {
          ...prev,
          mouthClosedCrop: {
            x: Math.min(0.95, open.x + 0.5),
            y: open.y,
            width: open.width,
            height: open.height
          }
        };
      });
    }
  };

  const switchMode = (m: 'crop' | 'place') => {
    setMode(m);
    setZoomScale(m === 'place' ? 1.8 : 1.0);
    selectTab(m === 'crop' ? 'eyesOpenCrop' : 'eyesPlace');
  };

  if (!parsedAssetSheetParts) return null;

  const setSymmetricWidth = (newW: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerX = b.x + b.width / 2;
      const newX = Math.max(0, Math.min(1 - newW, centerX - newW / 2));
      const res = { ...prev, [active]: { ...b, x: newX, width: newW } };
      if (active === 'eyesOpenCrop') {
        res.eyesClosedCrop = { ...res.eyesClosedCrop, width: newW };
      } else if (active === 'mouthOpenCrop') {
        res.mouthClosedCrop = { ...res.mouthClosedCrop, width: newW };
      }
      return res;
    });
  };

  const setSymmetricHeight = (newH: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerY = b.y + b.height / 2;
      const newY = Math.max(0, Math.min(1 - newH, centerY - newH / 2));
      const res = { ...prev, [active]: { ...b, y: newY, height: newH } };
      if (active === 'eyesOpenCrop') {
        res.eyesClosedCrop = { ...res.eyesClosedCrop, height: newH };
      } else if (active === 'mouthOpenCrop') {
        res.mouthClosedCrop = { ...res.mouthClosedCrop, height: newH };
      }
      return res;
    });
  };

  const setScaleProportional = (targetWidth: number) => {
    if (!active) return;
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerX = b.x + b.width / 2;
      const centerY = b.y + b.height / 2;
      const aspect = b.width / Math.max(0.001, b.height);

      const newW = Math.max(0.02, Math.min(0.95, targetWidth));
      const newH = Math.max(0.02, Math.min(0.95, newW / aspect));

      const newX = Math.max(0, Math.min(1 - newW, centerX - newW / 2));
      const newY = Math.max(0, Math.min(1 - newH, centerY - newH / 2));

      const res = { ...prev, [active]: { x: newX, y: newY, width: newW, height: newH } };
      if (active === 'eyesOpenCrop') {
        res.eyesClosedCrop = { ...res.eyesClosedCrop, width: newW, height: newH };
      } else if (active === 'mouthOpenCrop') {
        res.mouthClosedCrop = { ...res.mouthClosedCrop, width: newW, height: newH };
      }
      return res;
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

  const curBox = active ? (state[active as keyof EditorState] as Box) : null;
  const curCenterX = curBox ? (curBox.x + curBox.width / 2) : 0.5;
  const curCenterY = curBox ? (curBox.y + curBox.height / 2) : 0.5;

  const canvasProps = {
    state, setState,
    mode, active, setActive,
    sheetImg: sheetImgRef.current,
    baseImg: baseImgRef.current,
    removeWhiteBg,
    whiteThreshold,
    zoomScale,
  };

  // ─ FULLSCREEN OVERLAY ─
  if (fullscreen) {
    const isLoaded = !!(sheetImgRef.current && (sheetImgRef.current.complete || sheetImgRef.current.width > 0));

    if (!isLoaded) {
      return createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999, background: '#0f172a',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: '1.2rem', padding: '1rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>🎨 画像を読み込み・解析中...</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>しばらくお待ちください。認識が終わると編集画面が開きます。</div>
          <button onClick={handleClose} style={{
            padding: '0.6rem 1.2rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)',
            color: '#fca5a5', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 700, marginTop: '1rem'
          }}>✕ 閉じる / キャンセル</button>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div
        onContextMenu={(e) => e.preventDefault()}
        onSelectStart={(e) => e.preventDefault()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          zIndex: 99999,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >

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

          <button onClick={handleClose} style={{
            padding: '0.35rem 0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.78rem',
          }}><X size={14}/> 閉じる</button>

          {mode === 'crop' ? (
            <button onClick={() => switchMode('place')} style={{
              padding: '0.35rem 0.85rem', borderRadius: '8px',
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
              border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              boxShadow: '0 3px 12px rgba(99,102,241,0.4)'
            }}>次へ (画面2:貼り付け) →</button>
          ) : (
            <button onClick={handleConfirm} style={{
              padding: '0.35rem 0.85rem', borderRadius: '8px',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              boxShadow: '0 3px 12px rgba(16,185,129,0.4)'
            }}><Check size={14}/> 確定して開始 🎬</button>
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

        {/* ── Bottom control panel ── */}
        <div style={{
          background: 'rgba(15,23,42,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          padding: '0.5rem 0.75rem calc(2.2rem + env(safe-area-inset-bottom, 32px)) 0.75rem',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          zIndex: 10000,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}>
          {/* ── ROW A: PART TABS (切り抜き・貼り付けの対象パーツ選択) ── */}
          <div style={{
            display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.1rem',
          }}>
            {mode === 'crop' ? (
              cropButtons.map(key => (
                <button key={key} onClick={() => selectTab(key)} style={{
                  flex: 1, minWidth: '72px', padding: '0.42rem 0.3rem', borderRadius: '10px', fontSize: '0.82rem',
                  border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.15)'}`,
                  background: active===key ? `${COLORS[key]}40` : 'rgba(255,255,255,0.05)',
                  color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:500,
                  whiteSpace: 'nowrap', textAlign: 'center'
                }}>{LABELS[key]}</button>
              ))
            ) : (
              (['eyesPlace', 'mouthPlace'] as PlaceKey[]).map(key => (
                <button key={key} onClick={() => selectTab(key)} style={{
                  flex: 1, minWidth: '100px', padding: '0.42rem 0.3rem', borderRadius: '10px', fontSize: '0.82rem',
                  border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.15)'}`,
                  background: active===key ? `${COLORS[key]}40` : 'rgba(255,255,255,0.05)',
                  color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:500,
                  whiteSpace: 'nowrap', textAlign: 'center'
                }}>{LABELS[key]}</button>
              ))
            )}
          </div>

          {/* ── ROW B: SLIDERS (Max height 20vh for mobile compatibility) ── */}
          <div style={{ maxHeight: '20vh', overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y' }}>
            {active && curBox ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.8rem', width: '100%', boxSizing: 'border-box' }}>
                {/* パーツ一括拡大・縮小 (比率維持) */}
                <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem', gridColumn: '1 / -1', userSelect: 'none' }}>
                  <span style={{ fontSize:'0.75rem', color: COLORS[active], fontWeight: 700 }}>
                    🔍 「{LABELS[active]}」の枠一括 拡大・縮小: {(curBox.width * 100).toFixed(1)}%
                  </span>
                  <input type="range"
                    min="0.02" max="0.95" step="0.005"
                    value={curBox.width}
                    onChange={e => setScaleProportional(Number(e.target.value))}
                    style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%', touchAction: 'none' }}
                  />
                </label>

                {/* 横幅（左右） */}
                <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem', userSelect: 'none' }}>
                  <span style={{ fontSize:'0.68rem', color: '#cbd5e1' }}>
                    ↔ 横幅 (左右): {(curBox.width * 100).toFixed(1)}%
                  </span>
                  <input type="range"
                    min="0.02" max="0.95" step="0.005"
                    value={curBox.width}
                    onChange={e => setSymmetricWidth(Number(e.target.value))}
                    style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%', touchAction: 'none' }}
                  />
                </label>

                {/* 縦幅（上下） */}
                <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem', userSelect: 'none' }}>
                  <span style={{ fontSize:'0.68rem', color: '#cbd5e1' }}>
                    ↕ 縦幅 (上下): {(curBox.height * 100).toFixed(1)}%
                  </span>
                  <input type="range"
                    min="0.02" max="0.95" step="0.005"
                    value={curBox.height}
                    onChange={e => setSymmetricHeight(Number(e.target.value))}
                    style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%', touchAction: 'none' }}
                  />
                </label>

                {/* X位置 */}
                <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem', userSelect: 'none' }}>
                  <span style={{ fontSize:'0.68rem', color: '#94a3b8' }}>
                    ⬅➡ X位置 (左右中心): {(curCenterX * 100).toFixed(1)}%
                  </span>
                  <input type="range"
                    min="0" max="1" step="0.005"
                    value={curCenterX}
                    onChange={e => setCenterX(Number(e.target.value))}
                    style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%', touchAction: 'none' }}
                  />
                </label>

                {/* Y位置 */}
                <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem', userSelect: 'none' }}>
                  <span style={{ fontSize:'0.68rem', color: '#94a3b8' }}>
                    ⬆⬇ Y位置 (上下中心): {(curCenterY * 100).toFixed(1)}%
                  </span>
                  <input type="range"
                    min="0" max="1" step="0.005"
                    value={curCenterY}
                    onChange={e => setCenterY(Number(e.target.value))}
                    style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%', touchAction: 'none' }}
                  />
                </label>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '0.2rem' }}>
                👆 上のパーツボタン（✂ 開眼 など）をタップして調整を始めてください
              </div>
            )}
          </div>

          {/* ── ROW C: ALWAYS VISIBLE BIG ACTION BUTTON ── */}
          <div style={{ marginTop: '0.2rem' }}>
            {mode === 'crop' ? (
              <button
                onClick={() => switchMode('place')}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                }}
              >
                ✨ 切り抜き完了！ 次へ（顔の位置合わせ） →
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => switchMode('crop')}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← 戻る
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  🎬 配置確定してWebCamトラッキング開始！
                </button>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
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
