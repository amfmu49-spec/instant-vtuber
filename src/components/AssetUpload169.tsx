import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { parse16by9AssetSheet } from '../utils/avatarHelper';
import { analyze16by9AssetSheetWithGemini } from '../services/geminiService';
import { Upload, CheckCircle2, Sparkles, FolderOpen } from 'lucide-react';
import PartPlacementEditor from './PartPlacementEditor';

import { createSample16by9AssetSheetDataUrl } from '../utils/sampleAssetSheet';

export const AssetUpload169: React.FC = () => {
  const { 
    baseImage,
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
    setRemoveWhiteBg,
    setCustomSkinColors,
    setSensitivity,
    setCurrentProfileName,
    profileList,
    loadProfile,
    deleteProfile
  } = useAppContext();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(
    parsedAssetSheetParts?._originalSheetDataUrl || null
  );
  const [statusMsg, setStatusMsg] = useState<string>('');

  const handleJsonFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.baseImage) {
        alert('無効なキャラクター設定ファイルです。');
        return;
      }

      setBaseImage(data.baseImage);
      setOriginalGridImage(data.originalGridImage || null);
      setAvatarCoords(data.avatarCoords || null);
      setCustomSkinColors(data.customSkinColors || { leftEye: null, rightEye: null, mouth: null });
      setSensitivity(data.sensitivity || { eyeClose: 0.4, mouthOpen: 0.1 });
      setParsedAssetSheetParts(data.parsedAssetSheetParts || null);
      if (data.psdLayers) setPsdLayers(data.psdLayers);

      if (data.parsedAssetSheetParts) {
        setPreviewImage(data.parsedAssetSheetParts._originalSheetDataUrl || data.baseImage);
      } else {
        setPreviewImage(data.baseImage);
      }

      let name = file.name.replace('vtuber_char_', '').replace('.json', '');
      setCurrentProfileName(name);

      setStatusMsg('✅ キャラクター設定ファイルを読み込みました！トラッキング画面へ遷移します...');
      setTimeout(() => {
        navigate('/main');
      }, 800);
    } catch (err: any) {
      alert('ファイルの読み込みに失敗しました。');
      console.error(err);
    }
    e.target.value = '';
  };



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
            const parsed = await parse16by9AssetSheet(processImg as HTMLImageElement);
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

  const ASSET_SHEET_PROMPT = `A high-resolution, professional Live2D-ready VTuber asset sheet in a 16:9 widescreen layout on a clean white background.

CRITICAL LAYOUT SPECIFICATION:
The canvas is divided visually into two equal halves. Do NOT draw any divider line. Position the character in the center of the left half. Position all facial parts inside the right half.

LEFT HALF (Base Model):
- A front-facing anime-style character bust (chest up).
- Center the character within the left half.
- Leave a small, even margin on the left and right sides of the base model (approximately 5–8% of the left-half width). The character must never touch or extend beyond the edges of the left half.
- The bottom edge of the clothing/chest MUST align perfectly with the bottom edge of the canvas, leaving ZERO bottom margin.
- The face is a BLANK BASE MODEL containing ONLY:
  - A small, clean anime-style nose.
- Do NOT draw:
  - Eyes
  - Eyebrows
  - Mouth
- Hair, ears, head, neck, skin, clothing, accessories, and all other details must be fully rendered.

RIGHT HALF (Expression Parts):
Arrange each facial part neatly with generous spacing and no overlap.

Include:
- Open eyes WITH matching eyebrows attached.
- Closed eyes WITH matching eyebrows attached.
- Open mouth.
- Closed mouth with a subtle, relaxed smile (slightly raised corners, no teeth).

GENERAL REQUIREMENTS:
- The expression parts must perfectly match the base model in scale, style, perspective, lighting, shading, and colors.
- Keep every element completely inside its respective half of the canvas.
- No overlapping parts.
- No duplicate parts.
- No extra facial features.
- No text.
- No logos.
- No watermarks.
- No background decorations.
- Pure white background.
- Clean production-ready Live2D asset sheet.`;

  const OWN_CHAR_PROMPT = `A high-resolution Live2D-ready VTuber asset sheet based EXACTLY on the provided character design reference. Do not alter or reinterpret the character's style, clothes, hair, accessories, proportions, colors, materials, rendering style, or shading.

CRITICAL LAYOUT SPECIFICATION:
The canvas must be split EXACTLY in half vertically at the 50% X-coordinate.

LEFT HALF (0% to 50% width):
- The exact same reference character, front-facing bust (chest up).
- The bottom of the character's chest/clothes must touch the absolute bottom edge of the canvas with ZERO margin.
- Preserve the original eyebrows and nose ONLY IF they exist in the reference image.
- If the reference character has no visible eyebrows and/or no visible nose, do not create or invent them.
- Do NOT include:
  - Eyes
  - Eyelashes
  - Eye highlights
  - Mouth
  - Blush
  - Any facial expression
- Hair, head shape, ears, neck, clothing, accessories, colors, shading, and proportions must match the reference image exactly.

RIGHT HALF (50% to 100% width):
Arrange the facial parts cleanly with generous spacing:
- Both eyes open
- Both eyes closed
- Mouth open
- Mouth neutral (closed)

The facial parts must perfectly match the character's original design, color, rendering style, linework, lighting, and scale so they can be placed directly onto the blank base without adjustment.

BACKGROUND:
- Pure white or transparent.
- No text.
- No guides.
- No labels.
- No watermarks.
- No decorative elements.
- No background noise.

The asset sheet should be suitable for Live2D rigging with clean separation between the blank base and expression parts.`;

  const handleOpenChatGPTWithOwnChar = () => {
    const textArea = document.createElement("textarea");
    textArea.value = OWN_CHAR_PROMPT;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error(err);
    }
    document.body.removeChild(textArea);

    const encodedPrompt = encodeURIComponent(OWN_CHAR_PROMPT);
    window.location.href = `https://chatgpt.com/?q=${encodedPrompt}`;
  };

  const handleOpenChatGPT = () => {
    const fullPrompt = vtuberDescription.trim()
      ? `${vtuberDescription.trim()}\n\n${ASSET_SHEET_PROMPT}`
      : ASSET_SHEET_PROMPT;
    
    const textArea = document.createElement("textarea");
    textArea.value = fullPrompt;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error(err);
    }
    document.body.removeChild(textArea);

    const encodedPrompt = encodeURIComponent(fullPrompt);
    window.location.href = `https://chatgpt.com/?q=${encodedPrompt}`;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0fdf4', margin: 0 }}>
                ChatGPT でアセット画像を生成
              </h3>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '6px', background: '#10b981', color: '#fff', fontWeight: 700 }}>v1.11.0 マイク音量連動口パク機能追加</span>
            </div>
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

        {/* ── 手順ガイド ── */}
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
        }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e9d5ff', margin: '0 0 0.4rem 0' }}>
            ⚠️「自分のキャラクターを使う」手順：
          </p>
          <ol style={{
            margin: 0, paddingLeft: '1.2rem',
            fontSize: '0.78rem', color: '#c4b5fd', lineHeight: 1.8,
          }}>
            <li>ボタンを押すとChatGPTが開きます</li>
            <li><strong style={{ color: '#f0abfc' }}>送信する前に</strong>、使いたいキャラクターの画像を<strong style={{ color: '#f0abfc' }}>添付（📎クリップマーク）</strong>してください</li>
            <li>画像を添付した状態で送信すると、そのキャラのアセットシートが生成されます</li>
            <li>完成した画像をダウンロードして下のエリアにアップロード</li>
          </ol>
        </div>
      </div>

      {/* ── Browser-Native Saved Characters List ── */}
      {profileList && profileList.length > 0 && (
        <div style={{
          borderRadius: '16px',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(4, 120, 87, 0.25))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={20} color="#d1fae5" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d1fae5', margin: 0 }}>
                保存済みのキャラクターから起動 (ブラウザ保存)
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#a7f3d0', margin: 0 }}>
                ブラウザに直接保存したキャラクター一覧から選んで開始できます
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '220px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
          }}>
            {profileList.map((name) => (
              <div 
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                  👤 {name}
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={async () => {
                      setStatusMsg(`🚀 「${name}」をロード中...`);
                      await loadProfile(name);
                      setTimeout(() => {
                        navigate('/main');
                      }, 500);
                    }}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    選択して開始
                  </button>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`「${name}」の設定を削除しますか？`)) {
                        await deleteProfile(name);
                      }
                    }}
                    style={{
                      padding: '0.4rem',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="削除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── JSON Configuration Load Section ── */}
      <div style={{
        borderRadius: '16px',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(67, 56, 202, 0.25))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderOpen size={20} color="#e0e7ff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e0e7ff', margin: 0 }}>
              保存したキャラクターをロード (.json)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#c7d2fe', margin: 0 }}>
              以前保存したキャラ設定ファイルを選択して、一瞬でトラッキングを再開
            </p>
          </div>
        </div>

        <input 
          type="file" 
          ref={jsonInputRef}
          onChange={handleJsonFileImport}
          accept=".json"
          style={{ display: 'none' }}
        />

        <button
          onClick={() => jsonInputRef.current?.click()}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            padding: '0.85rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 20px rgba(79, 70, 229, 0.35)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(79, 70, 229, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(79, 70, 229, 0.35)';
          }}
        >
          📂 設定ファイルを読み込む
        </button>
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

      {baseImage && (
        <button
          onClick={() => navigate('/main')}
          style={{
            width: '100%',
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.05rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem'
          }}
        >
          🎬 WebCam トラッキング画面を開始する →
        </button>
      )}

      {/* Interactive Part Placement Editor */}
      {previewImage && parsedAssetSheetParts && (
        <PartPlacementEditor />
      )}

    </div>
  );
};

export default AssetUpload169;

