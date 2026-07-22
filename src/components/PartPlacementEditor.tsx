import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Play, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PartBox {
  x: number; // 0-1 relative to base image
  y: number;
  width: number;
  height: number;
}

interface DragState {
  part: 'leftEye' | 'rightEye' | 'mouth' | null;
  mode: 'move' | 'resize';
  startMouseX: number;
  startMouseY: number;
  startBox: PartBox;
}

export const PartPlacementEditor: React.FC = () => {
  const { parsedAssetSheetParts, avatarCoords, setAvatarCoords } = useAppContext();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [boxes, setBoxes] = useState<{ leftEye: PartBox; rightEye: PartBox; mouth: PartBox }>({
    leftEye: { x: 0.28, y: 0.30, width: 0.16, height: 0.12 },
    rightEye: { x: 0.56, y: 0.30, width: 0.16, height: 0.12 },
    mouth: { x: 0.38, y: 0.52, width: 0.22, height: 0.14 },
  });

  const [selected, setSelected] = useState<'leftEye' | 'rightEye' | 'mouth' | null>('leftEye');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const partsImgsRef = useRef<Record<string, HTMLImageElement>>({});

  // Initialize from existing avatarCoords if present
  useEffect(() => {
    if (avatarCoords?.leftEye && avatarCoords?.rightEye && avatarCoords?.mouth) {
      setBoxes({
        leftEye: avatarCoords.leftEye as PartBox,
        rightEye: avatarCoords.rightEye as PartBox,
        mouth: avatarCoords.mouth as PartBox,
      });
    }
  }, []);

  // Preload images
  useEffect(() => {
    if (!parsedAssetSheetParts) return;

    const loadImg = (src: string, key: string) => {
      const img = new Image();
      img.onload = () => {
        partsImgsRef.current[key] = img;
        redraw();
      };
      img.src = src;
    };

    const base = new Image();
    base.onload = () => {
      baseImgRef.current = base;
      redraw();
    };
    base.src = parsedAssetSheetParts.baseBustDataUrl;

    loadImg(parsedAssetSheetParts.eyesOpenDataUrl || parsedAssetSheetParts.leftEyeOpenDataUrl, 'eyesOpen');
    loadImg(parsedAssetSheetParts.eyesClosedDataUrl || parsedAssetSheetParts.leftEyeClosedDataUrl, 'eyesClosed');
    loadImg(parsedAssetSheetParts.mouthOpenDataUrl, 'mouthOpen');
    loadImg(parsedAssetSheetParts.mouthClosedDataUrl, 'mouthClosed');
  }, [parsedAssetSheetParts]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseImgRef.current;
    if (!canvas || !base) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Draw checkerboard transparent background
    const tileSize = 16;
    for (let ty = 0; ty < ch; ty += tileSize) {
      for (let tx = 0; tx < cw; tx += tileSize) {
        const even = ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0);
        ctx.fillStyle = even ? '#374151' : '#1f2937';
        ctx.fillRect(tx, ty, tileSize, tileSize);
      }
    }

    // Draw base face
    ctx.drawImage(base, 0, 0, cw, ch);

    // Draw part overlays using current boxes
    const partsToRender: Array<{ box: PartBox; imgKey: string; color: string; label: string; partKey: 'leftEye' | 'rightEye' | 'mouth' }> = [
      { box: boxes.leftEye, imgKey: 'eyesOpen', color: '#6366f1', label: '👁 左目', partKey: 'leftEye' },
      { box: boxes.rightEye, imgKey: 'eyesOpen', color: '#8b5cf6', label: '👁 右目', partKey: 'rightEye' },
      { box: boxes.mouth, imgKey: 'mouthClosed', color: '#ec4899', label: '👄 口', partKey: 'mouth' },
    ];

    for (const { box, imgKey, color, label, partKey } of partsToRender) {
      const bx = box.x * cw;
      const by = box.y * ch;
      const bw = box.width * cw;
      const bh = box.height * ch;

      const img = partsImgsRef.current[imgKey];
      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, bx, by, bw, bh);
        ctx.restore();
      }

      const isActive = selected === partKey;

      // Bounding box highlight
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.setLineDash(isActive ? [] : [5, 4]);
      ctx.globalAlpha = isActive ? 1.0 : 0.55;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();

      // Label badge
      ctx.save();
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx, by - 18, ctx.measureText(label).width + 8, 17);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, bx + 4, by - 5);
      ctx.restore();

      // Corner resize handle (active only)
      if (isActive) {
        const handles = [
          { hx: bx + bw - 6, hy: by + bh - 6 },
        ];
        for (const h of handles) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.fillRect(h.hx, h.hy, 10, 10);
          ctx.strokeRect(h.hx, h.hy, 10, 10);
          ctx.restore();
        }
      }
    }
  }, [boxes, selected]);

  useEffect(() => {
    redraw();
  }, [boxes, selected, redraw]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { cx: number; cy: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      cx: (e.clientX - rect.left) * scaleX,
      cy: (e.clientY - rect.top) * scaleY,
    };
  };

  const hitTest = (cx: number, cy: number) => {
    const canvas = canvasRef.current!;
    const cw = canvas.width;
    const ch = canvas.height;

    const parts = [
      { key: 'leftEye' as const, box: boxes.leftEye },
      { key: 'rightEye' as const, box: boxes.rightEye },
      { key: 'mouth' as const, box: boxes.mouth },
    ];

    for (const { key, box } of parts) {
      const bx = box.x * cw;
      const by = box.y * ch;
      const bw = box.width * cw;
      const bh = box.height * ch;

      // Check resize handle first (bottom-right 14x14 corner)
      if (selected === key && cx >= bx + bw - 14 && cx <= bx + bw + 2 && cy >= by + bh - 14 && cy <= by + bh + 2) {
        return { part: key, mode: 'resize' as const };
      }

      // Check move area
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        return { part: key, mode: 'move' as const };
      }
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasCoords(e);
    const hit = hitTest(cx, cy);
    if (!hit) {
      setSelected(null);
      return;
    }
    setSelected(hit.part);
    setDragState({
      part: hit.part,
      mode: hit.mode,
      startMouseX: cx,
      startMouseY: cy,
      startBox: { ...boxes[hit.part] },
    });
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState || !dragState.part) return;

    const canvas = canvasRef.current!;
    const cw = canvas.width;
    const ch = canvas.height;
    const { cx, cy } = getCanvasCoords(e);

    const dx = (cx - dragState.startMouseX) / cw;
    const dy = (cy - dragState.startMouseY) / ch;

    setBoxes(prev => {
      const startBox = dragState.startBox;
      const part = dragState.part!;

      let newBox: PartBox;
      if (dragState.mode === 'move') {
        newBox = {
          ...startBox,
          x: Math.max(0, Math.min(1 - startBox.width, startBox.x + dx)),
          y: Math.max(0, Math.min(1 - startBox.height, startBox.y + dy)),
        };
      } else {
        // resize
        newBox = {
          ...startBox,
          width: Math.max(0.04, Math.min(0.9, startBox.width + dx)),
          height: Math.max(0.03, Math.min(0.9, startBox.height + dy)),
        };
      }

      return { ...prev, [part]: newBox };
    });
  };

  const onMouseUp = () => {
    setDragState(null);
  };

  const handleConfirm = () => {
    setAvatarCoords({
      leftEye: boxes.leftEye,
      rightEye: boxes.rightEye,
      mouth: boxes.mouth,
      mouthState: 'closed',
      eyeState: 'open',
      neckY: 85,
      neckX: 50,
      removeWhiteBg: true,
    });
    navigate('/main');
  };

  const resetBoxes = () => {
    setBoxes({
      leftEye: { x: 0.28, y: 0.30, width: 0.16, height: 0.12 },
      rightEye: { x: 0.56, y: 0.30, width: 0.16, height: 0.12 },
      mouth: { x: 0.38, y: 0.52, width: 0.22, height: 0.14 },
    });
  };

  if (!parsedAssetSheetParts) return null;

  const partColors: Record<string, string> = {
    leftEye: '#6366f1',
    rightEye: '#8b5cf6',
    mouth: '#ec4899',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '14px',
        padding: '0.9rem 1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <Move size={22} color="#a855f7" />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
            🖱️ パーツ配置エディター — ドラッグして位置・サイズを調整
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            目・口のボックスをドラッグして移動、右下コーナーをドラッグしてサイズ変更できます。
          </p>
        </div>
        <button
          onClick={resetBoxes}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#94a3b8',
            padding: '0.4rem 0.9rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <RotateCcw size={14} />
          リセット
        </button>
      </div>

      {/* Part selector buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {([['leftEye', '👁 左目'], ['rightEye', '👁 右目'], ['mouth', '👄 口']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '20px',
              border: `2px solid ${selected === key ? partColors[key] : 'rgba(255,255,255,0.1)'}`,
              background: selected === key ? `${partColors[key]}33` : 'rgba(255,255,255,0.04)',
              color: selected === key ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: selected === key ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={750}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            width: '100%',
            cursor: dragState ? 'grabbing' : 'crosshair',
            display: 'block',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Numeric fine-tuning for selected part */}
      {selected && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: `1px solid ${partColors[selected]}44`,
          borderRadius: '12px',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem 1.25rem',
        }}>
          <h5 style={{ margin: 0, gridColumn: '1/-1', fontSize: '0.85rem', color: '#c084fc', fontWeight: 700 }}>
            🎚️ {selected === 'leftEye' ? '👁 左目' : selected === 'rightEye' ? '👁 右目' : '👄 口'} — 数値で微調整
          </h5>
          {(['x', 'y', 'width', 'height'] as const).map(field => (
            <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {field === 'x' ? 'X位置' : field === 'y' ? 'Y位置' : field === 'width' ? '横幅' : '縦幅'} ({(boxes[selected][field] * 100).toFixed(1)}%)
              </span>
              <input
                type="range"
                min={field === 'width' || field === 'height' ? 0.02 : 0}
                max={field === 'width' || field === 'height' ? 0.8 : 1}
                step={0.005}
                value={boxes[selected][field]}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBoxes(prev => ({
                    ...prev,
                    [selected]: { ...prev[selected], [field]: val }
                  }));
                }}
                style={{ accentColor: partColors[selected], cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>
      )}

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          border: 'none',
          padding: '1rem 2rem',
          borderRadius: '14px',
          fontWeight: 700,
          fontSize: '1.05rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        <Play size={22} fill="#fff" />
        この配置で WebCam トラッキング開始 🎬
      </button>
    </div>
  );
};

export default PartPlacementEditor;
