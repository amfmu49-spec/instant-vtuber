import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Play, RotateCcw, Scissors, MapPin, Maximize2, X, Check, Sliders } from 'lucide-react';

interface Box { x: number; y: number; width: number; height: number; }

type CropKey = 'eyesOpenCrop' | 'eyesClosedCrop' | 'mouthOpenCrop' | 'mouthClosedCrop';
type PlaceKey = 'eyesPlace' | 'mouthPlace';
type ActiveKey = CropKey | PlaceKey;

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
  isFullscreen?: boolean;
}> = ({ state, setState, mode, active, setActive, sheetImg, baseImg, isFullscreen }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    key: ActiveKey; handle: DragHandle;
    startMX: number; startMY: number; startBox: Box;
  } | null>(null);

  const visibleKeys: ActiveKey[] = mode === 'crop'
    ? ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop']
    : ['eyesPlace', 'mouthPlace'];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    // Checkerboard bg
    ctx.clearRect(0, 0, cw, ch);
    for (let ty = 0; ty < ch; ty += 16)
      for (let tx = 0; tx < cw; tx += 16) {
        ctx.fillStyle = ((Math.floor(tx/16)+Math.floor(ty/16))%2===0) ? '#374151':'#1f2937';
        ctx.fillRect(tx, ty, 16, 16);
      }

    if (mode === 'crop') {
      // Right half of sheet only
      if (sheetImg) {
        const sw = sheetImg.naturalWidth || sheetImg.width;
        const sh = sheetImg.naturalHeight || sheetImg.height;
        ctx.drawImage(sheetImg, sw / 2, 0, sw / 2, sh, 0, 0, cw, ch);
      }
      ctx.save();
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='bold 12px system-ui';
      ctx.fillText('✂ パーツ切り抜きエリア (右側半分)', 8, 18);
      ctx.restore();
    } else {
      // Left half of sheet only (base bust)
      if (sheetImg) {
        const sw = sheetImg.naturalWidth || sheetImg.width;
        const sh = sheetImg.naturalHeight || sheetImg.height;
        ctx.drawImage(sheetImg, 0, 0, sw / 2, sh, 0, 0, cw, ch);
      }
      ctx.save();
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='bold 12px system-ui';
      ctx.fillText('📍 貼り付け位置指定 (左側素体)', 8, 18);
      ctx.restore();
    }

    for (const key of visibleKeys) {
      const box = state[key as keyof EditorState] as Box;
      const isAct = active === key;

      const bx = box.x * cw;
      const by = box.y * ch;
      const bw = box.width * cw;
      const bh = box.height * ch;
      const color = COLORS[key];

      ctx.save(); ctx.globalAlpha = isAct ? 0.18 : 0.07; ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, bh); ctx.restore();

      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = isAct ? 2.5 : 1.5;
      ctx.setLineDash(isAct ? [] : [5,4]); ctx.globalAlpha = isAct ? 1 : 0.55;
      ctx.strokeRect(bx, by, bw, bh); ctx.restore();

      const label = LABELS[key];
      ctx.save();
      ctx.font = `bold ${isAct ? 12 : 10}px system-ui`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = color; ctx.globalAlpha = 0.92;
      ctx.fillRect(bx, Math.max(0, by - 18), tw, 17);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
      ctx.fillText(label, bx + 4, Math.max(12, by - 5)); ctx.restore();

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
  }, [state, active, mode, sheetImg, baseImg, visibleKeys]);

  useEffect(() => { draw(); }, [draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) {
      return { cx: (e.touches[0].clientX - r.left)*sx, cy: (e.touches[0].clientY - r.top)*sy };
    }
    return { cx: (e.clientX - r.left)*sx, cy: (e.clientY - r.top)*sy };
  };

  const hitTest = (cx: number, cy: number): { key: ActiveKey; handle: DragHandle } | null => {
    const cw = canvasRef.current!.width, ch = canvasRef.current!.height;
    for (const key of [...visibleKeys].reverse()) {
      const box = state[key as keyof EditorState] as Box;
      const bx = box.x * cw, by = box.y * ch, bw = box.width * cw, bh = box.height * ch;

      if (active === key) {
        const tol = 16;
        if (Math.abs(cy - by) <= tol && cx >= bx + 14 && cx <= bx + bw - 14) return { key, handle: 'n' };
        if (Math.abs(cy - (by + bh)) <= tol && cx >= bx + 14 && cx <= bx + bw - 14) return { key, handle: 's' };
        if (Math.abs(cx - bx) <= tol && cy >= by + 14 && cy <= by + bh - 14) return { key, handle: 'w' };
        if (Math.abs(cx - (bx + bw)) <= tol && cy >= by + 14 && cy <= by + bh - 14) return { key, handle: 'e' };

        if (Math.abs(cx - bx) <= tol && Math.abs(cy - by) <= tol) return { key, handle: 'nw' };
        if (Math.abs(cx - (bx + bw)) <= tol && Math.abs(cy - by) <= tol) return { key, handle: 'ne' };
        if (Math.abs(cx - bx) <= tol && Math.abs(cy - (by + bh)) <= tol) return { key, handle: 'sw' };
        if (Math.abs(cx - (bx + bw)) <= tol && Math.abs(cy - (by + bh)) <= tol) return { key, handle: 'se' };
      }

      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        return { key, handle: 'move' };
      }
    }
    return null;
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
    const cw = canvasRef.current!.width, ch = canvasRef.current!.height;
    const dx = (cx - startMX) / cw;
    const dy = (cy - startMY) / ch;
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
    if (!hit) return;
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
  const [active, setActive] = useState<ActiveKey>('eyesOpenCrop');
  const [state, setState] = useState<EditorState>(DEFAULT_STATE);
  // Fullscreen open by default
  const [fullscreen, setFullscreen] = useState(true);

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
    setActive(m === 'crop' ? 'eyesOpenCrop' : 'eyesPlace');
  };

  if (!parsedAssetSheetParts) return null;

  const visibleKeys: ActiveKey[] = mode === 'crop'
    ? ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop']
    : ['eyesPlace', 'mouthPlace'];

  const canvasProps = {
    state, setState, mode, active, setActive,
    sheetImg: sheetImgRef.current,
    baseImg: baseImgRef.current,
  };

  const curBox = state[active as keyof EditorState] as Box;

  // Symmetric width update (center X fixed)
  const setSymmetricWidth = (newW: number) => {
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerX = b.x + b.width / 2;
      const newX = Math.max(0, Math.min(1 - newW, centerX - newW / 2));
      return { ...prev, [active]: { ...b, x: newX, width: newW } };
    });
  };

  // Symmetric height update (center Y fixed)
  const setSymmetricHeight = (newH: number) => {
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const centerY = b.y + b.height / 2;
      const newY = Math.max(0, Math.min(1 - newH, centerY - newH / 2));
      return { ...prev, [active]: { ...b, y: newY, height: newH } };
    });
  };

  const setCenterX = (newCX: number) => {
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const newX = Math.max(0, Math.min(1 - b.width, newCX - b.width / 2));
      return { ...prev, [active]: { ...b, x: newX } };
    });
  };

  const setCenterY = (newCY: number) => {
    setState(prev => {
      const b = prev[active as keyof EditorState] as Box;
      const newY = Math.max(0, Math.min(1 - b.height, newCY - b.height / 2));
      return { ...prev, [active]: { ...b, y: newY } };
    });
  };

  const curCenterX = (curBox.x + curBox.width / 2);
  const curCenterY = (curBox.y + curBox.height / 2);

  // ─ FULLSCREEN OVERLAY (PRIMARY EDITOR VIEW) ─
  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}>

        {/* ── ROW 1: Mode tabs + confirm/close ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 0.6rem',
          background: 'rgba(15,23,42,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <button onClick={() => switchMode('crop')} style={{
            padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
            border: `2px solid ${mode==='crop'?'#6366f1':'rgba(255,255,255,0.1)'}`,
            background: mode==='crop'?'rgba(99,102,241,0.3)':'transparent',
            color: mode==='crop'?'#a5b4fc':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}><Scissors size={14}/> 1. 切り抜き</button>

          <button onClick={() => switchMode('place')} style={{
            padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
            border: `2px solid ${mode==='place'?'#10b981':'rgba(255,255,255,0.1)'}`,
            background: mode==='place'?'rgba(16,185,129,0.3)':'transparent',
            color: mode==='place'?'#6ee7b7':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}><MapPin size={14}/> 2. 貼り付け</button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setState(DEFAULT_STATE)} style={{
            padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem',
          }}><RotateCcw size={13}/></button>

          <button onClick={() => setFullscreen(false)} style={{
            padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.78rem',
          }}><X size={14}/></button>

          <button onClick={handleConfirm} style={{
            padding: '0.35rem 0.9rem', borderRadius: '8px',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            boxShadow: '0 3px 12px rgba(16,185,129,0.4)'
          }}><Check size={15}/> 確定</button>
        </div>

        {/* ── ROW 2: Part selection + Transparency slider ── */}
        <div style={{
          display: 'flex', gap: '0.5rem', padding: '0.35rem 0.6rem',
          background: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(visibleKeys as ActiveKey[]).map(key => (
              <button key={key} onClick={() => setActive(key)} style={{
                padding: '0.2rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem',
                border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.1)'}`,
                background: active===key ? `${COLORS[key]}30` : 'transparent',
                color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:400,
              }}>{LABELS[key]}</button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Sliders size={13} color="#c084fc" />
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>透過: {whiteThreshold}</span>
            <input
              type="range"
              min="180"
              max="255"
              step="1"
              value={whiteThreshold}
              onChange={(e) => setWhiteThreshold(Number(e.target.value))}
              style={{ width: '80px', accentColor: '#a855f7', cursor: 'pointer' }}
            />
            <label style={{ fontSize: '0.72rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={removeWhiteBg}
                onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                style={{ accentColor: '#a855f7' }}
              />
              白透過
            </label>
          </div>
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

        {/* ── Bottom sliders: 2×2 compact grid (Symmetric Width/Height & Center) ── */}
        <div style={{
          background: 'rgba(15,23,42,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '0.45rem 0.65rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.3rem 0.8rem',
          flexShrink: 0,
        }}>
          {/* 横幅（左右狭まる） */}
          <label style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
            <span style={{ fontSize:'0.68rem', color: COLORS[active], fontWeight: 600 }}>
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
            <span style={{ fontSize:'0.68rem', color: COLORS[active], fontWeight: 600 }}>
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
            <span style={{ fontSize:'0.68rem', color: '#94a3b8' }}>
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
            <span style={{ fontSize:'0.68rem', color: '#94a3b8' }}>
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
      </div>
    );
  }

  // ─ COMPACT INLINE BACKUP VIEW ─
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
