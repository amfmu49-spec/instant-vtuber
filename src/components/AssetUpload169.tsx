import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { parse16by9AssetSheet } from '../utils/avatarHelper';
import { analyze16by9AssetSheetWithGemini } from '../services/geminiService';
import { Upload, CheckCircle2, Sparkles } from 'lucide-react';
import PartPlacementEditor from './PartPlacementEditor';

export const AssetUpload169: React.FC = () => {
  const { 
    geminiApiKey,
    setBaseImage, 
    setParsedAssetSheetParts, 
    setAvatarCoords, 
    parsedAssetSheetParts,
    setOriginalGridImage,
    setPsdLayers,
    whiteThreshold,
    setWhiteThreshold,
    removeWhiteBg,
    setRemoveWhiteBg
  } = useAppContext();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const processUploadedImageWithThreshold = (file: File, thresh: number) => {
    setIsProcessing(true);
    setStatusMsg(geminiApiKey ? '🤖 Google Gemini AIが画像のパーツ切り抜き位置＆顔配置を自動認識中...' : '16:9 アセットシートの解体・切り出し中...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewImage(dataUrl);

      const img = new Image();
      img.onload = async () => {
        // Downscale large images to prevent browser freeze
        const MAX_WIDTH = 2560;
        let processImg: HTMLImageElement | HTMLCanvasElement = img;
        let processDataUrl = dataUrl;

        if (img.naturalWidth > MAX_WIDTH) {
          const scale = MAX_WIDTH / img.naturalWidth;
          const newW = MAX_WIDTH;
          const newH = Math.round(img.naturalHeight * scale);
          const downCanvas = document.createElement('canvas');
          downCanvas.width = newW;
          downCanvas.height = newH;
          const dCtx = downCanvas.getContext('2d');
          if (dCtx) {
            dCtx.drawImage(img, 0, 0, newW, newH);
          }
          processDataUrl = downCanvas.toDataURL('image/png');
          // Create an HTMLImageElement from the downscaled canvas
          const downImg = new Image();
          downImg.src = processDataUrl;
          await new Promise<void>(resolve => { downImg.onload = () => resolve(); });
          processImg = downImg;
        }

        // Use setTimeout to let the UI render the status message before heavy processing
        setTimeout(async () => {
          try {
            const parsed = parse16by9AssetSheet(processImg as HTMLImageElement);
            // Store the sheet dataUrl so the editor can display it
            (parsed as any)._originalSheetDataUrl = processDataUrl;

            if (geminiApiKey) {
              try {
                const aiResult = await analyze16by9AssetSheetWithGemini(geminiApiKey, processDataUrl);
                if (aiResult) {
                  setAvatarCoords({
                    leftEye: aiResult.targetLeftEyePlacement,
                    rightEye: aiResult.targetRightEyePlacement,
                    mouth: aiResult.targetMouthPlacement,
                    mouthState: 'closed',
                    eyeState: 'open',
                    neckY: 85,
                    neckX: 50,
                    removeWhiteBg: removeWhiteBg
                  });
                  setStatusMsg('✨ Google Gemini AIによるパーツ切り抜き＆顔位置の全自動認識が完了しました！');
                } else {
                  setAvatarCoords({
                    leftEye: parsed.suggestedCoords.leftEye,
                    rightEye: parsed.suggestedCoords.rightEye,
                    mouth: parsed.suggestedCoords.mouth,
                    mouthState: 'closed',
                    eyeState: 'open',
                    neckY: 85,
                    neckX: 50,
                    removeWhiteBg: removeWhiteBg
                  });
                  setStatusMsg('✅ 16:9 アセットシートの自動切り出しが完了しました！');
                }
              } catch (aiErr) {
                setAvatarCoords({
                  leftEye: parsed.suggestedCoords.leftEye,
                  rightEye: parsed.suggestedCoords.rightEye,
                  mouth: parsed.suggestedCoords.mouth,
                  mouthState: 'closed',
                  eyeState: 'open',
                  neckY: 85,
                  neckX: 50,
                  removeWhiteBg: removeWhiteBg
                });
                setStatusMsg('✅ 16:9 アセットシートの自動切り出しが完了しました！');
              }
            } else {
              setAvatarCoords({
                leftEye: parsed.suggestedCoords.leftEye,
                rightEye: parsed.suggestedCoords.rightEye,
                mouth: parsed.suggestedCoords.mouth,
                mouthState: 'closed',
                eyeState: 'open',
                neckY: 85,
                neckX: 50,
                removeWhiteBg: removeWhiteBg
              });
              setStatusMsg('✅ 16:9 アセットシートの自動切り出しが完了しました！');
            }

            setParsedAssetSheetParts(parsed);
            setBaseImage(parsed.baseBustDataUrl);
            setOriginalGridImage(null);
            setPsdLayers(null);

          } catch (err: any) {
            console.error("16:9 parsing error:", err);
            setStatusMsg('画像の解体に失敗しました。');
          } finally {
            setIsProcessing(false);
          }
        }, 50); // Small delay to let the UI paint the loading message
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const processUploadedImage = (file: File) => {
    processUploadedImageWithThreshold(file, whiteThreshold);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedImage(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedImage(file);
    }
  };

  const handleStartTracking = () => {
    navigate('/main');
  };

  const [vtuberDescription, setVtuberDescription] = useState<string>('');

  const ASSET_SHEET_PROMPT = `A high-resolution VTuber asset sheet designed for Live2D animation, in a clean 16:9 layout on a transparent or plain white background.

The canvas is divided vertically into two halves:

LEFT HALF:
A front-facing anime-style character bust (from chest up), with full hair, head, and body details.
The face is mostly blank, but includes a simple, cleanly drawn nose (small anime-style nose).
There are no eyes, no mouth, no eyebrows, only the nose is present.
The face area is smooth and clean, designed as a base layer for facial parts.

RIGHT HALF:
Organized expression parts for the same character, neatly arranged and clearly separated:

* Both eyes open (neutral expression)
* Both eyes closed
* Mouth open
* Mouth neutral (closed, straight line)

All parts must match perfectly in style, size, and alignment with the base face on the left.
Use crisp anime-style linework, soft shading, and consistent lighting.

The character should have a modern VTuber aesthetic (clean, appealing, slightly stylized, suitable for streaming avatar use).

Ensure precise alignment and spacing for easy rigging in Live2D.
No background clutter, no text, no watermark.`;

  const OWN_CHAR_PROMPT = `Use the provided character image as the exact reference.

Create a high-resolution VTuber asset sheet designed for Live2D animation in a clean 16:9 layout on a transparent or plain white background.

IMPORTANT:
Do not redesign, restyle, reinterpret, or alter the character.
Preserve the exact hairstyle, hair color, face shape, eyes, clothing, accessories, proportions, linework, coloring, shading, and overall art style from the reference image.
The output must be the exact same character, not a newly generated interpretation.

The canvas is divided vertically into two halves.

LEFT HALF:
A front-facing anime-style character bust (from chest up), using the exact same character from the reference.
Keep the full hair, head, neck, clothing, and accessories unchanged.
The face is mostly blank, but includes a simple, cleanly drawn anime-style nose.
There are no eyes, no mouth, and no eyebrows.
The face area is smooth and clean, designed as a base layer for Live2D facial parts.

RIGHT HALF:
Organized expression parts for the exact same character, neatly arranged in a 2×2 grid and clearly separated:

• Top Left: Both eyes open (neutral expression)
• Top Right: Both eyes closed
• Bottom Left: Mouth open
• Bottom Right: Mouth neutral (closed)

All facial parts must match perfectly in style, size, proportions, and alignment with the base face on the left.
The eyes must align perfectly with the empty eye area.
The mouth must align perfectly with the empty mouth area.
Maintain identical linework, coloring, shading, lighting, and proportions as the reference image.

The character should remain identical to the reference image while being prepared as a professional Live2D asset sheet.

Ensure precise alignment and spacing for easy rigging in Live2D.

No background clutter.
No text.
No watermark.
No additional parts.
Only the specified layout.`;

  const handleOpenChatGPTWithOwnChar = () => {
    const fullPrompt = `このプロンプトと一緒に、VTuber化したいキャラクターの画像を添付してください。\n\n${OWN_CHAR_PROMPT}`;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    window.open(`https://chatgpt.com/?q=${encodedPrompt}`, '_blank');
  };

  const handleOpenChatGPT = () => {
    const fullPrompt = vtuberDescription.trim()
      ? `${vtuberDescription.trim()}\n\n${ASSET_SHEET_PROMPT}`
      : ASSET_SHEET_PROMPT;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    window.open(`https://chatgpt.com/?q=${encodedPrompt}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── ChatGPT VTuber Generator Section ── */}
      <div style={{
        borderRadius: '16px',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(16, 163, 127, 0.12), rgba(6, 78, 59, 0.25))',
        border: '1px solid rgba(16, 163, 127, 0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #10a37f, #1a7f64)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(16, 163, 127, 0.4)',
            fontSize: '18px',
          }}>🤖</div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0fdf4', margin: 0 }}>
              ChatGPT でアセット画像を生成
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#86efac', margin: 0 }}>
              どんなVTuberにしたいか入力して、ワンクリックでChatGPTへ
            </p>
          </div>
        </div>

        <textarea
          value={vtuberDescription}
          onChange={(e) => setVtuberDescription(e.target.value)}
          placeholder="例: 銀髪ツインテールの猫耳メイド風VTuber、紫色の瞳で可愛い系"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid rgba(16, 163, 127, 0.35)',
            background: 'rgba(0, 0, 0, 0.35)',
            color: '#f0fdf4',
            fontSize: '0.92rem',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 163, 127, 0.7)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 163, 127, 0.35)'; }}
        />

        <button
          onClick={handleOpenChatGPT}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            padding: '0.85rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #10a37f, #0d8c6d)',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 20px rgba(16, 163, 127, 0.35)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(16, 163, 127, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 163, 127, 0.35)';
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🚀</span>
          ChatGPT で新規作成
        </button>

        {/* ── 自分のキャラクターを使うボタン ── */}
        <button
          onClick={handleOpenChatGPTWithOwnChar}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            padding: '0.85rem 1.5rem',
            borderRadius: '12px',
            border: '2px solid rgba(168, 85, 247, 0.5)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.15))',
            color: '#e9d5ff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(168, 85, 247, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🎨</span>
          自分のキャラクターを使う
        </button>

        <p style={{
          fontSize: '0.72rem', color: '#c4b5fd', margin: '0.4rem 0 0 0',
          textAlign: 'center', opacity: 0.8
        }}>
          ※ ChatGPTが開いたら、使いたいキャラクターの画像を添付してください
        </p>

        <p style={{
          fontSize: '0.75rem', color: '#6ee7b7', margin: '0.5rem 0 0 0',
          textAlign: 'center', opacity: 0.7
        }}>
          生成が完了したら画像をダウンロードして下のエリアにアップロードしてください
        </p>
      </div>

      {/* ── Divider ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        color: '#64748b', fontSize: '0.8rem',
      }}>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(100,116,139,0.4), transparent)' }} />
        <span>画像を入手したら下へアップロード</span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(100,116,139,0.4), transparent)' }} />
      </div>

      {/* Upload Zone Header */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed rgba(99, 102, 241, 0.5)',
          borderRadius: '16px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/png, image/jpeg, image/webp" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />

        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1rem auto',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
        }}>
          <Upload size={32} color="#ffffff" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
          16:9 VTuber アセット画像をアップロード
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '480px', margin: '0 auto 1rem auto', lineHeight: 1.5 }}>
          ここをクリック、または画像をドラッグ＆ドロップしてください。<br />
          （PNG / JPEG / WebP 16:9 レイアウト対応）
        </p>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#c084fc',
          fontSize: '0.82rem'
        }}>
          <Sparkles size={14} />
          <span>左側: 素体 / 右上: 開眼・閉眼 / 右下: 開口・閉口</span>
        </div>
      </div>

      {statusMsg && (
        <div style={{ 
          padding: '0.85rem 1rem', 
          borderRadius: '10px', 
          background: isProcessing ? 'rgba(99, 102, 241, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `1px solid ${isProcessing ? 'rgba(99, 102, 241, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          color: isProcessing ? '#818cf8' : '#4ade80',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Interactive Part Placement Editor */}
      {previewImage && parsedAssetSheetParts && (
        <PartPlacementEditor />
      )}

    </div>
  );
};

export default AssetUpload169;

