import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Play, Move, RotateCcw, Scissors, MapPin } from 'lucide-react';

interface Box { x: number; y: number; width: number; height: number; }

type CropKey = 'eyesOpenCrop' | 'eyesClosedCrop' | 'mouthOpenCrop' | 'mouthClosedCrop';
type PlaceKey = 'eyesPlace' | 'mouthPlace';
type ActiveKey = CropKey | PlaceKey;

interface EditorState {
  eyesOpenCrop: Box;
  eyesClosedCrop: Box;
  mouthOpenCrop: Box;
  mouthClosedCrop: Box;
  eyesPlace: Box;  // on left half face (0-0.5 relative to full img)
  mouthPlace: Box;
}

const COLORS: Record<string, string> = {
  eyesOpenCrop: '#6366f1',
  eyesClosedCrop: '#8b5cf6',
  mouthOpenCrop: '#ec4899',
  mouthClosedCrop: '#f43f5e',
  eyesPlace: '#10b981',
  mouthPlace: '#f59e0b',
};

const LABELS: Record<string, string> = {
  eyesOpenCrop: '✂ 開眼 (右側から切り抜き)',
  eyesClosedCrop: '✂ 閉眼 (右側から切り抜き)',
  mouthOpenCrop: '✂ 開口 (右側から切り抜き)',
  mouthClosedCrop: '✂ 閉口 (右側から切り抜き)',
  eyesPlace: '📍 目の貼り付け位置 (左側素体)',
  mouthPlace: '📍 口の貼り付け位置 (左側素体)',
};

export const PartPlacementEditor: React.FC = () => {
  const { parsedAssetSheetParts, avatarCoords, setAvatarCoords, setParsedAssetSheetParts } = useAppContext();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'crop' | 'place'>('crop');

  const [state, setState] = useState<EditorState>({
    // Default crop zones: Right half quadrants (x relative to FULL image 0-1)
    eyesOpenCrop:   { x: 0.50, y: 0.02, width: 0.24, height: 0.45 },
    eyesClosedCrop: { x: 0.76, y: 0.02, width: 0.24, height: 0.45 },
    mouthOpenCrop:  { x: 0.50, y: 0.52, width: 0.24, height: 0.45 },
    mouthClosedCrop:{ x: 0.76, y: 0.52, width: 0.24, height: 0.45 },
    // Default placement zones: Left half (x 0-0.5 relative to base image = 0-1)
    eyesPlace:  { x: 0.20, y: 0.25, width: 0.60, height: 0.22 },
    mouthPlace: { x: 0.30, y: 0.52, width: 0.40, height: 0.18 },
  });

  const [active, setActive] = useState<ActiveKey>('eyesOpenCrop');

  const baseImgRef = useRef<HTMLImageElement | null>(null);
  // Full 16:9 sheet image (for crop editor)
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null);

  const dragRef = useRef<{
    key: ActiveKey;
    mode: 'move' | 'resize';
    startMX: number;
    startMY: number;
    startBox: Box;
  } | null>(null);

  // Try to recover original sheet from parsedAssetSheetParts
  useEffect(() => {
    if (!parsedAssetSheetParts) return;
    // If the base bust data url is stored, use it for display
    if (parsedAssetSheetParts._originalSheetDataUrl) {
      setSheetDataUrl(parsedAssetSheetParts._originalSheetDataUrl);
      const img = new Image();
      img.onload = () => { baseImgRef.current = img; redraw(); };
      img.src = parsedAssetSheetParts._originalSheetDataUrl;
    } else if (parsedAssetSheetParts.baseBustDataUrl) {
      // If no full sheet, use base bust
      setSheetDataUrl(parsedAssetSheetParts.baseBustDataUrl);
      const img = new Image();
      img.onload = () => { baseImgRef.current = img; redraw(); };
      img.src = parsedAssetSheetParts.baseBustDataUrl;
    }
  }, [parsedAssetSheetParts]);

  const activeKeys = mode === 'crop'
    ? ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'] as CropKey[]
    : ['eyesPlace', 'mouthPlace'] as PlaceKey[];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseImgRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Checkerboard bg
    ctx.clearRect(0, 0, cw, ch);
    for (let ty = 0; ty < ch; ty += 16) {
      for (let tx = 0; tx < cw; tx += 16) {
        ctx.fillStyle = ((Math.floor(tx / 16) + Math.floor(ty / 16)) % 2 === 0) ? '#374151' : '#1f2937';
        ctx.fillRect(tx, ty, 16, 16);
      }
    }

    if (img) {
      if (mode === 'crop') {
        // Show full 16:9 sheet (if available), else show base bust tiled
        ctx.drawImage(img, 0, 0, cw, ch);

        // Draw divider line at center
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cw / 2, 0);
        ctx.lineTo(cw / 2, ch);
        ctx.stroke();
        ctx.restore();

        // Labels
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText('◀ 左半分: 素体 (のっぺらぼう)', 8, 14);
        ctx.fillText('▶ 右半分: パーツ素材 (切り抜き元)', cw / 2 + 6, 14);
        ctx.restore();
      } else {
        // In place mode, show just left half (base bust, 1x aspect) on full canvas
        ctx.drawImage(img, 0, 0, cw, ch);
      }
    }

    // Draw all boxes for current mode
    const keys = mode === 'crop'
      ? ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'] as ActiveKey[]
      : ['eyesPlace', 'mouthPlace'] as ActiveKey[];

    for (const key of keys) {
      const box = state[key as keyof EditorState] as Box;
      const isActive = active === key;

      // In place mode, the box coordinates are relative to the left half (0-1) -> canvas coords
      let bx: number, by: number, bw: number, bh: number;
      if (mode === 'place') {
        bx = box.x * cw;
        by = box.y * ch;
        bw = box.width * cw;
        bh = box.height * ch;
      } else {
        // crop: coordinates are 0-1 relative to full image
        bx = box.x * cw;
        by = box.y * ch;
        bw = box.width * cw;
        bh = box.height * ch;
      }

      const color = COLORS[key];

      // Fill overlay
      ctx.save();
      ctx.globalAlpha = isActive ? 0.15 : 0.07;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();

      // Border
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.setLineDash(isActive ? [] : [5, 4]);
      ctx.globalAlpha = isActive ? 1.0 : 0.6;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();

      // Label
      const label = LABELS[key];
      ctx.save();
      ctx.font = `bold ${isActive ? 12 : 10}px system-ui`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx, by - 18, tw, 17);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 1;
      ctx.fillText(label, bx + 4, by - 5);
      ctx.restore();

      // Resize handle
      if (isActive) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(bx + bw - 8, by + bh - 8, 14, 14);
        ctx.strokeRect(bx + bw - 8, by + bh - 8, 14, 14);
        ctx.restore();
      }
    }
  }, [state, active, mode]);

  useEffect(() => { redraw(); }, [state, active, mode, redraw]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let cx: number, cy: number;
    if ('touches' in e) {
      cx = (e.touches[0].clientX - rect.left) * scaleX;
      cy = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      cx = (e.clientX - rect.left) * scaleX;
      cy = (e.clientY - rect.top) * scaleY;
    }
    return { cx, cy };
  };

  const hitTest = (cx: number, cy: number) => {
    const cw = canvasRef.current!.width;
    const ch = canvasRef.current!.height;
    const keys = mode === 'crop'
      ? ['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'] as ActiveKey[]
      : ['eyesPlace', 'mouthPlace'] as ActiveKey[];

    for (const key of [...keys].reverse()) {
      const box = state[key as keyof EditorState] as Box;
      const bx = box.x * cw;
      const by = box.y * ch;
      const bw = box.width * cw;
      const bh = box.height * ch;

      if (active === key && cx >= bx + bw - 14 && cx <= bx + bw + 4 && cy >= by + bh - 14 && cy <= by + bh + 4) {
        return { key, dragMode: 'resize' as const };
      }
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        return { key, dragMode: 'move' as const };
      }
    }
    return null;
  };

  const onPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasCoords(e);
    const hit = hitTest(cx, cy);
    if (!hit) { setActive(activeKeys[0]); return; }
    setActive(hit.key);
    dragRef.current = {
      key: hit.key,
      mode: hit.dragMode,
      startMX: cx,
      startMY: cy,
      startBox: { ...(state[hit.key as keyof EditorState] as Box) },
    };
    e.preventDefault();
  };

  const onPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { cx, cy } = getCanvasCoords(e);
    const { key, mode: dmode, startMX, startMY, startBox } = dragRef.current;
    const cw = canvasRef.current!.width;
    const ch = canvasRef.current!.height;
    const dx = (cx - startMX) / cw;
    const dy = (cy - startMY) / ch;

    setState(prev => {
      let nb: Box;
      if (dmode === 'move') {
        nb = {
          ...startBox,
          x: Math.max(0, Math.min(1 - startBox.width, startBox.x + dx)),
          y: Math.max(0, Math.min(1 - startBox.height, startBox.y + dy)),
        };
      } else {
        nb = {
          ...startBox,
          width: Math.max(0.02, Math.min(1, startBox.width + dx)),
          height: Math.max(0.02, Math.min(1, startBox.height + dy)),
        };
      }
      return { ...prev, [key]: nb };
    });
  };

  const onPointerUp = () => { dragRef.current = null; };

  // Apply crops to parsedAssetSheetParts
  const applyManualCrops = () => {
    if (!parsedAssetSheetParts || !baseImgRef.current) return;
    const img = baseImgRef.current;
    const iw = img.width;
    const ih = img.height;

    const cropCanvas = (box: Box) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(box.width * iw));
      c.height = Math.max(1, Math.round(box.height * ih));
      c.getContext('2d')?.drawImage(img, box.x * iw, box.y * ih, box.width * iw, box.height * ih, 0, 0, c.width, c.height);
      return c.toDataURL();
    };

    const updatedParts = {
      ...parsedAssetSheetParts,
      eyesOpenDataUrl: cropCanvas(state.eyesOpenCrop),
      eyesClosedDataUrl: cropCanvas(state.eyesClosedCrop),
      mouthOpenDataUrl: cropCanvas(state.mouthOpenCrop),
      mouthClosedDataUrl: cropCanvas(state.mouthClosedCrop),
    };
    setParsedAssetSheetParts(updatedParts);
  };

  const handleConfirm = () => {
    applyManualCrops();

    // eyesPlace: 0-1 relative to left half. 
    // AvatarCoords leftEye/rightEye use 0-1 relative to baseImage
    // Set leftEye = full eyesPlace (eyes as one unit)
    setAvatarCoords({
      leftEye: null,  // not used separately
      rightEye: null,
      mouth: state.mouthPlace,
      mouthState: 'closed',
      eyeState: 'open',
      neckY: 85,
      neckX: 50,
      removeWhiteBg: true,
      eyesBox: state.eyesPlace,  // unified eyes placement
    } as any);
    navigate('/main');
  };

  const reset = () => {
    setState({
      eyesOpenCrop:   { x: 0.50, y: 0.02, width: 0.24, height: 0.45 },
      eyesClosedCrop: { x: 0.76, y: 0.02, width: 0.24, height: 0.45 },
      mouthOpenCrop:  { x: 0.50, y: 0.52, width: 0.24, height: 0.45 },
      mouthClosedCrop:{ x: 0.76, y: 0.52, width: 0.24, height: 0.45 },
      eyesPlace: { x: 0.20, y: 0.25, width: 0.60, height: 0.22 },
      mouthPlace: { x: 0.30, y: 0.52, width: 0.40, height: 0.18 },
    });
  };

  if (!parsedAssetSheetParts) return null;

  const visibleKeys = mode === 'crop'
    ? (['eyesOpenCrop', 'eyesClosedCrop', 'mouthOpenCrop', 'mouthClosedCrop'] as CropKey[])
    : (['eyesPlace', 'mouthPlace'] as PlaceKey[]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => { setMode('crop'); setActive('eyesOpenCrop'); }}
          style={{
            flex: 1,
            padding: '0.65rem',
            borderRadius: '10px',
            border: `2px solid ${mode === 'crop' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
            background: mode === 'crop' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: mode === 'crop' ? 700 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          <Scissors size={16} />
          ✂ STEP 1: 切り抜き位置を指定 (右側)
        </button>
        <button
          onClick={() => { setMode('place'); setActive('eyesPlace'); }}
          style={{
            flex: 1,
            padding: '0.65rem',
            borderRadius: '10px',
            border: `2px solid ${mode === 'place' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
            background: mode === 'place' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: mode === 'place' ? 700 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          <MapPin size={16} />
          📍 STEP 2: 貼り付け位置を指定 (左側)
        </button>
      </div>

      {/* Part selector */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {(visibleKeys as ActiveKey[]).map(key => (
          <button
            key={key}
            onClick={() => setActive(key)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '16px',
              border: `2px solid ${active === key ? COLORS[key] : 'rgba(255,255,255,0.1)'}`,
              background: active === key ? `${COLORS[key]}28` : 'rgba(255,255,255,0.04)',
              color: active === key ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: active === key ? 700 : 400,
            }}
          >
            {LABELS[key].replace('✂ ', '').replace('📍 ', '')}
          </button>
        ))}
        <button
          onClick={reset}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.82rem',
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          <RotateCcw size={13} />
          リセット
        </button>
      </div>

      {/* Canvas */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={394}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          style={{ width: '100%', cursor: dragRef.current ? 'grabbing' : 'crosshair', display: 'block', userSelect: 'none' }}
        />
      </div>

      {/* Sliders for selected box */}
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: `1px solid ${COLORS[active]}44`,
        borderRadius: '12px',
        padding: '0.85rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.6rem 1rem',
      }}>
        <div style={{ gridColumn: '1/-1', fontSize: '0.82rem', color: COLORS[active], fontWeight: 700 }}>
          🎚️ {LABELS[active]} — 数値微調整
        </div>
        {(['x', 'y', 'width', 'height'] as const).map(field => (
          <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {field === 'x' ? 'X位置' : field === 'y' ? 'Y位置' : field === 'width' ? '横幅' : '縦幅'} ({((state[active as keyof EditorState] as Box)[field] * 100).toFixed(1)}%)
            </span>
            <input
              type="range"
              min={field === 'width' || field === 'height' ? 0.02 : 0}
              max={field === 'width' || field === 'height' ? 0.95 : 1}
              step={0.005}
              value={(state[active as keyof EditorState] as Box)[field]}
              onChange={e => {
                const v = Number(e.target.value);
                setState(prev => ({ ...prev, [active]: { ...(prev[active as keyof EditorState] as Box), [field]: v } }));
              }}
              style={{ accentColor: COLORS[active], cursor: 'pointer' }}
            />
          </label>
        ))}
      </div>

      <button
        onClick={handleConfirm}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          border: 'none',
          padding: '0.9rem 2rem',
          borderRadius: '14px',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
        }}
      >
        <Play size={20} fill="#fff" />
        この配置で切り抜き＆WebCam トラッキング開始 🎬
      </button>
    </div>
  );
};

export default PartPlacementEditor;
