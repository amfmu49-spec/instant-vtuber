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
        try {
          const parsed = parse16by9AssetSheet(img);

          if (geminiApiKey) {
            try {
              const aiResult = await analyze16by9AssetSheetWithGemini(geminiApiKey, dataUrl);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
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

      {/* Transparency slider always visible after upload */}
      {previewImage && parsedAssetSheetParts && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* 透過レベル調整スライダー */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                🎚️ 背景透過スレッショルド (口の内部保護)
              </label>
              <span style={{ fontSize: '0.85rem', color: '#c084fc', fontFamily: 'monospace', fontWeight: 600 }}>
                {whiteThreshold} / 255 {whiteThreshold >= 250 ? '(低感度: 純白のみ)' : whiteThreshold <= 210 ? '(高感度)' : '(標準)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                min="180"
                max="255"
                step="1"
                value={whiteThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWhiteThreshold(val);
                  if (fileInputRef.current?.files?.[0]) {
                    processUploadedImageWithThreshold(fileInputRef.current.files[0], val);
                  }
                }}
                style={{ flex: 1, accentColor: '#a855f7', cursor: 'pointer' }}
              />
              <label style={{ fontSize: '0.85rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={removeWhiteBg}
                  onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                  style={{ accentColor: '#a855f7' }}
                />
                白背景透過
              </label>
            </div>
          </div>

          {/* Interactive Part Placement Editor */}
          <PartPlacementEditor />
        </div>
      )}

    </div>
  );
};

export default AssetUpload169;
