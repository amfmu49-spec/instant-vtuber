import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { parse16by9AssetSheet } from '../utils/avatarHelper';
import { analyze16by9AssetSheetWithGemini } from '../services/geminiService';
import { Upload, Play, CheckCircle2, Layers, Image as ImageIcon, Sparkles, Bot } from 'lucide-react';

export const AssetUpload169: React.FC = () => {
  const { 
    geminiApiKey,
    setBaseImage, 
    setParsedAssetSheetParts, 
    setAvatarCoords, 
    parsedAssetSheetParts,
    setOriginalGridImage,
    setPsdLayers
  } = useAppContext();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const processUploadedImage = (file: File) => {
    setIsProcessing(true);
    setStatusMsg(geminiApiKey ? '🤖 Google Gemini AIが画像のパーツ切り抜き位置＆顔配置を自動認識中...' : '16:9 アセットシートの解体・切り出し中...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewImage(dataUrl);

      const img = new Image();
      img.onload = async () => {
        try {
          // 1. 基本の切り出しスライス
          const parsed = parse16by9AssetSheet(img);

          // 2. Gemini APIキーがある場合、Gemini Multimodal AIで高精度なパーツ切り抜き＆顔配置座標を取得
          if (geminiApiKey) {
            try {
              const aiResult = await analyze16by9AssetSheetWithGemini(geminiApiKey, dataUrl);
              if (aiResult) {
                console.log("Applying Gemini AI Vision cropping and placement coordinates!");
                setAvatarCoords({
                  leftEye: aiResult.targetLeftEyePlacement,
                  rightEye: aiResult.targetRightEyePlacement,
                  mouth: aiResult.targetMouthPlacement,
                  mouthState: 'closed',
                  eyeState: 'open',
                  neckY: 85,
                  neckX: 50,
                  removeWhiteBg: true
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
                  removeWhiteBg: true
                });
                setStatusMsg('✅ 16:9 アセットシートの自動切り出しが完了しました！');
              }
            } catch (aiErr) {
              console.warn("Gemini AI analysis fallback:", aiErr);
              setAvatarCoords({
                leftEye: parsed.suggestedCoords.leftEye,
                rightEye: parsed.suggestedCoords.rightEye,
                mouth: parsed.suggestedCoords.mouth,
                mouthState: 'closed',
                eyeState: 'open',
                neckY: 85,
                neckX: 50,
                removeWhiteBg: true
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
              removeWhiteBg: true
            });
            setStatusMsg('✅ 16:9 アセットシートの自動切り出しが完了しました！');
          }

          setParsedAssetSheetParts(parsed);
          setBaseImage(parsed.baseBustDataUrl);
          setOriginalGridImage(null);
          setPsdLayers(null);

        } catch (err: any) {
          console.error("16:9 parsing error:", err);
          setStatusMsg('画像の解体に失敗しました。16:9のアセット画像であることを確認してください。');
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setStatusMsg('画像の読み込みに失敗しました。');
        setIsProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
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

      {/* Sliced Layout Preview & Action Button */}
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="#a855f7" />
              切り出しパーツのプレビュー (Live2D連動)
            </h4>

            <button
              onClick={handleStartTracking}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Play size={20} fill="#ffffff" />
              <span>WebCam トラッキングを開始する</span>
            </button>
          </div>

          {/* Sliced Parts Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
            gap: '1rem' 
          }}>
            
            {/* Part 1: Base Bust */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                🖼️ 左半身: ベース素体
              </span>
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={parsedAssetSheetParts.baseBustDataUrl} alt="Base Bust" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Part 2: Left Eye Open */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                👀 左目 (開眼)
              </span>
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={parsedAssetSheetParts.leftEyeOpenDataUrl || parsedAssetSheetParts.eyesOpenDataUrl} alt="Left Eye Open" style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Part 3: Left Eye Closed */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                😌 左目 (閉眼)
              </span>
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={parsedAssetSheetParts.leftEyeClosedDataUrl || parsedAssetSheetParts.eyesClosedDataUrl} alt="Left Eye Closed" style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Part 4: Mouth Open */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                😮 口 (開口パーツ)
              </span>
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={parsedAssetSheetParts.mouthOpenDataUrl} alt="Mouth Open" style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Part 5: Mouth Closed */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                😶 口 (閉口パーツ)
              </span>
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={parsedAssetSheetParts.mouthClosedDataUrl} alt="Mouth Closed" style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain' }} />
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default AssetUpload169;
