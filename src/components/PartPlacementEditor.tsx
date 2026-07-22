import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Play, RotateCcw, Scissors, MapPin, Maximize2, X, Check } from 'lucide-react';

interface Box { x: number; y: number; width: number; height: number; }

type CropKey = 'eyesOpenCrop' | 'eyesClosedCrop' | 'mouthOpenCrop' | 'mouthClosedCrop';
type PlaceKey = 'eyesPlace' | 'mouthPlace';
type ActiveKey = CropKey | PlaceKey;

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
  eyesPlace:  '📍 目（両目）貼り付け位置',
  mouthPlace: '📍 口 貼り付け位置',
};

const DEFAULT_STATE: EditorState = {
  // Crop coords = relative to RIGHT HALF only (0-1 maps to right 50% of sheet)
  // Sheet right half is split: top-left=眼開, top-right=眼閉, bottom-left=口開, bottom-right=口閉
  eyesOpenCrop:   { x: 0.0,  y: 0.0,  width: 0.5,  height: 0.5  },
  eyesClosedCrop: { x: 0.5,  y: 0.0,  width: 0.5,  height: 0.5  },
  mouthOpenCrop:  { x: 0.0,  y: 0.5,  width: 0.5,  height: 0.5  },
  mouthClosedCrop:{ x: 0.5,  y: 0.5,  width: 0.5,  height: 0.5  },
  // Place coords = relative to LEFT HALF (base bust) 0-1
  eyesPlace:  { x: 0.15, y: 0.26, width: 0.70, height: 0.24 },
  mouthPlace: { x: 0.25, y: 0.53, width: 0.50, height: 0.18 },
};

// ─────────────────────────────────────────────
// Inner editor (used both inline and fullscreen)
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
    key: ActiveKey; dragMode: 'move' | 'resize';
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
      // Show RIGHT HALF of full sheet only
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
      // Show LEFT HALF of full sheet only (base bust)
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

      // Badge
      const label = LABELS[key];
      ctx.save();
      ctx.font = `bold ${isAct ? 12 : 10}px system-ui`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = color; ctx.globalAlpha = 0.92;
      ctx.fillRect(bx, Math.max(0, by - 18), tw, 17);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
      ctx.fillText(label, bx + 4, Math.max(12, by - 5)); ctx.restore();

      // Resize handle
      if (isAct) {
        ctx.save(); ctx.fillStyle='#fff'; ctx.strokeStyle=color; ctx.lineWidth=2;
        ctx.fillRect(bx+bw-8, by+bh-8, 14, 14);
        ctx.strokeRect(bx+bw-8, by+bh-8, 14, 14); ctx.restore();
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

  const hitTest = (cx: number, cy: number) => {
    const cw = canvasRef.current!.width, ch = canvasRef.current!.height;
    for (const key of [...visibleKeys].reverse()) {
      const box = state[key as keyof EditorState] as Box;
      const bx=box.x*cw, by=box.y*ch, bw=box.width*cw, bh=box.height*ch;
      if (active===key && cx>=bx+bw-14 && cx<=bx+bw+4 && cy>=by+bh-14 && cy<=by+bh+4)
        return { key: key as ActiveKey, dragMode: 'resize' as const };
      if (cx>=bx && cx<=bx+bw && cy>=by && cy<=by+bh)
        return { key: key as ActiveKey, dragMode: 'move' as const };
    }
    return null;
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const {cx,cy} = getCoords(e);
    const hit = hitTest(cx, cy);
    if (!hit) return;
    setActive(hit.key);
    dragRef.current = { key: hit.key, dragMode: hit.dragMode, startMX: cx, startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) } };
    e.preventDefault();
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const {cx,cy} = getCoords(e);
    const {key, dragMode, startMX, startMY, startBox} = dragRef.current;
    const cw = canvasRef.current!.width, ch = canvasRef.current!.height;
    const dx=(cx-startMX)/cw, dy=(cy-startMY)/ch;
    setState(prev => {
      const nb: Box = dragMode === 'move'
        ? { ...startBox, x: Math.max(0,Math.min(1-startBox.width, startBox.x+dx)), y: Math.max(0,Math.min(1-startBox.height, startBox.y+dy)) }
        : { ...startBox, width: Math.max(0.02,Math.min(1, startBox.width+dx)), height: Math.max(0.02,Math.min(1, startBox.height+dy)) };
      return { ...prev, [key]: nb };
    });
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const {cx,cy} = getCoords(e);
    const {key, dragMode, startMX, startMY, startBox} = dragRef.current;
    const cw = canvasRef.current!.width, ch = canvasRef.current!.height;
    const dx=(cx-startMX)/cw, dy=(cy-startMY)/ch;
    setState(prev => {
      const nb: Box = dragMode === 'move'
        ? { ...startBox, x: Math.max(0,Math.min(1-startBox.width, startBox.x+dx)), y: Math.max(0,Math.min(1-startBox.height, startBox.y+dy)) }
        : { ...startBox, width: Math.max(0.02,Math.min(1, startBox.width+dx)), height: Math.max(0.02,Math.min(1, startBox.height+dy)) };
      return { ...prev, [key]: nb };
    });
    e.preventDefault();
  };

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const {cx,cy} = getCoords(e);
    const hit = hitTest(cx, cy);
    if (!hit) return;
    setActive(hit.key);
    dragRef.current = { key: hit.key, dragMode: hit.dragMode, startMX: cx, startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) } };
    e.preventDefault();
  };

  const onUp = () => { dragRef.current = null; };

  // Canvas intrinsic size: 16:9
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
// Main exported component
// ─────────────────────────────────────────────
export const PartPlacementEditor: React.FC = () => {
  const { parsedAssetSheetParts, setAvatarCoords, setParsedAssetSheetParts } = useAppContext();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'crop' | 'place'>('crop');
  const [active, setActive] = useState<ActiveKey>('eyesOpenCrop');
  const [state, setState] = useState<EditorState>(DEFAULT_STATE);
  const [fullscreen, setFullscreen] = useState(false);

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

  // Lock body scroll in fullscreen
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
    const halfW = iw / 2;  // Crop coords are relative to right half only

    // box.x/y/width/height are 0-1 relative to the right half
    const crop = (box: Box) => {
      const c = document.createElement('canvas');
      c.width  = Math.max(1, Math.round(box.width  * halfW));
      c.height = Math.max(1, Math.round(box.height * ih));
      // Source x starts at halfW (right half origin) + box.x * halfW
      c.getContext('2d')?.drawImage(img,
        halfW + box.x * halfW, box.y * ih,
        box.width * halfW, box.height * ih,
        0, 0, c.width, c.height);
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
      removeWhiteBg: true,
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

  // ─ FULLSCREEN OVERLAY ─
  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        height: '100dvh',       // dynamic viewport height (handles mobile address bar)
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
          {/* STEP tabs */}
          <button onClick={() => switchMode('crop')} style={{
            padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
            border: `2px solid ${mode==='crop'?'#6366f1':'rgba(255,255,255,0.1)'}`,
            background: mode==='crop'?'rgba(99,102,241,0.3)':'transparent',
            color: mode==='crop'?'#a5b4fc':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}><Scissors size={13}/> 切り抜き</button>

          <button onClick={() => switchMode('place')} style={{
            padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
            border: `2px solid ${mode==='place'?'#10b981':'rgba(255,255,255,0.1)'}`,
            background: mode==='place'?'rgba(16,185,129,0.3)':'transparent',
            color: mode==='place'?'#6ee7b7':'#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}><MapPin size={13}/> 貼り付け</button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Reset + Close + Confirm */}
          <button onClick={() => setState(DEFAULT_STATE)} style={{
            padding: '0.3rem 0.55rem', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
          }}><RotateCcw size={12}/></button>

          <button onClick={() => setFullscreen(false)} style={{
            padding: '0.3rem 0.55rem', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
          }}><X size={14}/></button>

          <button onClick={handleConfirm} style={{
            padding: '0.3rem 0.8rem', borderRadius: '7px',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}><Check size={14}/> 確定</button>
        </div>

        {/* ── ROW 2: Part selector pills ── */}
        <div style={{
          display: 'flex', gap: '0.3rem', padding: '0.35rem 0.6rem',
          background: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {(visibleKeys as ActiveKey[]).map(key => (
            <button key={key} onClick={() => setActive(key)} style={{
              padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem',
              border: `2px solid ${active===key ? COLORS[key] : 'rgba(255,255,255,0.1)'}`,
              background: active===key ? `${COLORS[key]}30` : 'transparent',
              color: active===key ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: active===key?700:400,
            }}>{LABELS[key]}</button>
          ))}
        </div>

        {/* ── Canvas: fills all remaining space ── */}
        <div style={{
          flex: 1,
          minHeight: 0,          // ← critical: lets flex child shrink below content size
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '2px',
        }}>
          <EditorCanvas {...canvasProps} isFullscreen />
        </div>

        {/* ── Bottom sliders: 2×2 compact grid ── */}
        <div style={{
          background: 'rgba(15,23,42,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '0.45rem 0.65rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.3rem 0.8rem',
          flexShrink: 0,
        }}>
          {(['x','y','width','height'] as const).map(field => (
            <label key={field} style={{ display:'flex', flexDirection:'column', gap:'0.08rem' }}>
              <span style={{ fontSize:'0.68rem', color: COLORS[active], fontWeight: 600 }}>
                {field==='x'?'X位置':field==='y'?'Y位置':field==='width'?'横幅':'縦幅'} {((state[active as keyof EditorState] as Box)[field]*100).toFixed(1)}%
              </span>
              <input type="range"
                min={field==='width'||field==='height'?0.02:0}
                max={field==='width'||field==='height'?0.95:1}
                step={0.005}
                value={(state[active as keyof EditorState] as Box)[field]}
                onChange={e => setState(prev => ({
                  ...prev,
                  [active]: { ...(prev[active as keyof EditorState] as Box), [field]: Number(e.target.value) }
                }))}
                style={{ accentColor: COLORS[active], cursor:'pointer', width: '100%' }}
              />
            </label>
          ))}
        </div>
      </div>
    );
  }


  // ─ INLINE (compact) ─
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
      {/* Open fullscreen button */}
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
          transition: 'all 0.2s',
        }}
      >
        <Maximize2 size={22} />
        🖱️ フルスクリーンでパーツ配置エディターを開く
      </button>

      {/* Confirm button (skip editor) */}
      <button
        onClick={handleConfirm}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', border: 'none',
          padding: '0.8rem 2rem', borderRadius: '12px',
          fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
        }}
      >
        <Play size={18} fill="#fff" />
        現在の配置でそのままトラッキング開始
      </button>
    </div>
  );
};

export default PartPlacementEditor;
