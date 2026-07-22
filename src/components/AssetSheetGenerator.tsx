import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { generateVTuberAssetSheet, generateVTuberAssetSheetPrompt } from '../services/geminiService';
import { parse16by9AssetSheet } from '../utils/avatarHelper';
import { createSample16by9AssetSheetDataUrl } from '../utils/sampleAssetSheet';
import { Sparkles, Wand2, RefreshCw, Key, Play, Download, Check, Layers, Image as ImageIcon, Eye, Smile, AlertCircle, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PresetOption {
  name: string;
  emoji: string;
  prompt: string;
}

const PRESET_CHARACTERS: PresetOption[] = [
  {
    name: '銀髪ネコミミセーラー服',
    emoji: '🐱',
    prompt: 'cute anime girl with silver long hair, cat ears, vibrant blue eyes, wearing chic pastel blue sailor uniform with red ribbon'
  },
  {
    name: 'ゴシックロリータ姫',
    emoji: '👑',
    prompt: 'gothic lolita anime girl with dark purple wavy hair, twin tails, crimson red eyes, ornate black lace headband and rose dress'
  },
  {
    name: 'サイバーパンクアイドル',
    emoji: '⚡',
    prompt: 'futuristic cyberpunk vtuber girl with bright neon pink hair, yellow glowing eyes, wearing metallic jacket with hologram badges'
  },
  {
    name: '狐耳和風巫女さん',
    emoji: '🦊',
    prompt: 'fox spirit shrine maiden anime girl with soft white hair, fox ears, golden eyes, traditional red and white miko outfit with bell hairpin'
  },
  {
    name: 'ツンデレ小悪魔メイド',
    emoji: '👿',
    prompt: 'cute small demon maid girl with pink hair, tiny black wings, bat horn hair clips, sharp fangs, red anime eyes, black maid dress'
  }
];

export const AssetSheetGenerator: React.FC = () => {
  const { 
    geminiApiKey, 
    setGeminiApiKey,
    assetSheetPrompt,
    setAssetSheetPrompt,
    assetSheetImage,
    setAssetSheetImage,
    parsedAssetSheetParts,
    setParsedAssetSheetParts,
    setBaseImage,
    setAvatarCoords,
    setPsdLayers
  } = useAppContext();

  const navigate = useNavigate();

  const [useFreeMode, setUseFreeMode] = useState<boolean>(!geminiApiKey);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPromptDetails, setShowPromptDetails] = useState<boolean>(false);

  const [customApiKeyInput, setCustomApiKeyInput] = useState<string>(geminiApiKey);
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(!geminiApiKey);

  const handleSaveApiKey = () => {
    setGeminiApiKey(customApiKeyInput.trim());
    if (customApiKeyInput.trim()) {
      setUseFreeMode(false);
      setShowApiKeyInput(false);
    }
  };

  const handleLoadSample = () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGenerationStep('デモ用16:9 VTuberアセットシートを読み込み中...');

    const sampleUrl = createSample16by9AssetSheetDataUrl();
    setAssetSheetImage(sampleUrl);

    const img = new Image();
    img.src = sampleUrl;
    img.onload = () => {
      try {
        const parsed = parse16by9AssetSheet(img);
        setParsedAssetSheetParts(parsed);
        setGenerationStep('✅ サンプルの16:9 VTuberアセットシートを分解切り出しました！');
      } catch (e: any) {
        console.error("Failed to parse sample sheet:", e);
        setErrorMsg("サンプル画像の読み込みに失敗しました。");
      } finally {
        setIsGenerating(false);
      }
    };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGenerationStep('AIプロンプトを構築中...');

    try {
      setGenerationStep(useFreeMode ? '無料AIで16:9 VTuberアセットシートをレンダリング中 (約10〜15秒)...' : 'Gemini Imagen 3 APIで16:9 VTuberアセットシートを生成中...');
      
      const apiKeyToUse = useFreeMode ? '' : geminiApiKey;
      const dataUrl = await generateVTuberAssetSheet(apiKeyToUse, assetSheetPrompt, useFreeMode);

      setAssetSheetImage(dataUrl);

      setGenerationStep('アセットシート（左: 顔無素体 / 右: 表情4種）の自動解析・切り出し中...');

      const img = new Image();
      if (dataUrl.startsWith('http')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = dataUrl;

      img.onload = () => {
        try {
          const parsed = parse16by9AssetSheet(img);
          setParsedAssetSheetParts(parsed);
          setGenerationStep('✅ アセットシートの生成＆16:9Live2Dパーツ分離が完了しました！');
        } catch (e: any) {
          console.error("Failed to parse 16:9 sheet:", e);
          setErrorMsg("アセットシートの分離解析に失敗しました。もう一度試すか画像を再生成してください。");
        } finally {
          setIsGenerating(false);
        }
      };

      img.onerror = () => {
        setErrorMsg("生成画像の読み込みに失敗しました。");
        setIsGenerating(false);
      };

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "画像生成中にエラーが発生しました。");
      setIsGenerating(false);
    }
  };

  const handleApplyToLive2D = () => {
    if (!parsedAssetSheetParts) return;

    // Set base image to the extracted Left Half (Blank face bust)
    setBaseImage(parsedAssetSheetParts.baseBustDataUrl);
    setPsdLayers(null);

    // Apply auto-suggested coordinates for eye and mouth placement
    setAvatarCoords({
      leftEye: parsedAssetSheetParts.suggestedCoords.leftEye,
      rightEye: parsedAssetSheetParts.suggestedCoords.rightEye,
      mouth: parsedAssetSheetParts.suggestedCoords.mouth,
      mouthState: 'closed',
      eyeState: 'open',
      neckY: 90,
      neckX: 50,
      removeWhiteBg: true
    });

    navigate('/main');
  };

  const handleDownloadPart = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 50%, rgba(236, 72, 153, 0.25) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sparkles className="animate-spin-slow" size={28} style={{ color: '#c084fc' }} />
              16:9 VTuber アセットシート AI Studio
            </h2>
            <p style={{ color: '#e2e8f0', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
              左半身（のっぺらぼうベース素体）と右半身（見開き目・閉じ目・開口・閉口パーツ）を統一スタイルの16:9アセットシートとしてAI一括生成します。
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              className={useFreeMode ? 'button-secondary' : 'button-primary'}
              onClick={() => setUseFreeMode(false)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              🔑 API Key (Imagen 3)
            </button>
            <button 
              className={useFreeMode ? 'button-primary' : 'button-secondary'}
              onClick={() => setUseFreeMode(true)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              ⚡ Free AI (キー不要)
            </button>
          </div>
        </div>

        {/* API Key Modal / Form */}
        {(!useFreeMode || showApiKeyInput) && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Google Gemini API Key (Imagen 3モデルで高解像度16:9アセットシートを生成)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '600px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Key size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="password"
                  className="input-field"
                  style={{ paddingLeft: '2.2rem', fontSize: '0.9rem' }}
                  placeholder="AIzaSy..."
                  value={customApiKeyInput}
                  onChange={(e) => setCustomApiKeyInput(e.target.value)}
                />
              </div>
              <button className="button-primary" onClick={handleSaveApiKey} style={{ padding: '0.5rem 1rem' }}>
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Setup Section */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
          <Wand2 size={20} style={{ color: '#818cf8' }} />
          1. VTuberキャラクターデザインの指定
        </h3>

        {/* Presets */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            ワンクリック・デザインプリセット
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PRESET_CHARACTERS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setAssetSheetPrompt(preset.prompt)}
                style={{
                  background: assetSheetPrompt === preset.prompt ? 'rgba(129, 140, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: assetSheetPrompt === preset.prompt ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  borderRadius: '20px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>{preset.emoji}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Prompt Text Area */}
        <div className="form-group">
          <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>詳細プロンプト（髪型・衣装・色・装飾など）</label>
          <textarea
            className="input-field"
            rows={3}
            value={assetSheetPrompt}
            onChange={(e) => setAssetSheetPrompt(e.target.value)}
            placeholder="例: cute anime girl with silver hair, twin tails, blue eyes, wearing stylish sailor uniform"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Formatted Prompt Spec View Toggle */}
        <div style={{ marginTop: '0.5rem' }}>
          <button 
            type="button"
            onClick={() => setShowPromptDetails(!showPromptDetails)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showPromptDetails ? '▲ 16:9アセットシート自動プロンプト構造を隠す' : '▼ 送信される16:9アセットシート完全プロンプト構造を確認'}
          </button>

          {showPromptDetails && (
            <pre style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              marginTop: '0.5rem',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {generateVTuberAssetSheetPrompt(assetSheetPrompt)}
            </pre>
          )}
        </div>

        {/* Generate Action Buttons */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              flex: '2 1 300px',
              padding: '1rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
              border: 'none',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={22} className="animate-spin" />
                <span>{generationStep || 'アセットシート生成中...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={22} />
                <span>16:9 VTuber アセットシートを生成する</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={handleLoadSample}
            disabled={isGenerating}
            style={{
              flex: '1 1 200px',
              padding: '1rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#f1f5f9'
            }}
            title="ネット接続不要で16:9アセットシートの分離＆Live2Dトラッキング動作を即時確認できます"
          >
            <Palette size={18} style={{ color: '#38bdf8' }} />
            <span>🎨 デモサンプルで即時テスト</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Generated Result & Slicer Inspection Panel */}
      {assetSheetImage && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80' }}>
              <Check size={22} /> 2. 16:9 アセットシート解体・分離プレビュー
            </h3>

            {parsedAssetSheetParts && (
              <button
                type="button"
                className="button-primary"
                onClick={handleApplyToLive2D}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Play size={18} />
                <span>Live2D トラッキングに適用する</span>
              </button>
            )}
          </div>

          {/* 16:9 Full Sheet View with Divider line overlay */}
          <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', background: '#1e293b' }}>
            <img src={assetSheetImage} alt="16:9 VTuber Asset Sheet" style={{ width: '100%', height: 'auto', display: 'block' }} />
            
            {/* Overlay line showing left/right half split */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: '2px',
              background: 'linear-gradient(to bottom, #ef4444, #3b82f6)',
              boxShadow: '0 0 8px rgba(255,255,255,0.8)'
            }}>
              <div style={{ position: 'absolute', top: '10px', left: '-130px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                LEFT: のっぺらぼう素体
              </div>
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(59, 130, 246, 0.9)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                RIGHT: 表情パーツ4種
              </div>
            </div>
          </div>

          {/* Sliced Parts Display Grid */}
          {parsedAssetSheetParts && (
            <div>
              <h4 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={18} style={{ color: '#c084fc' }} />
                自動抽出されたパーツ一覧 (Live2Dリギング用)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                
                {/* Part 1: Base Bust */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                    🖼️ 左半身: ベース素体
                  </span>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={parsedAssetSheetParts.baseBustDataUrl} alt="Base Bust" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                  <button 
                    onClick={() => handleDownloadPart(parsedAssetSheetParts.baseBustDataUrl, 'vtuber_base_bust.png')} 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Download size={12} /> PNG保存
                  </button>
                </div>

                {/* Part 2: Eyes Open */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                    👀 両目 (見開き・通常)
                  </span>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={parsedAssetSheetParts.eyesOpenDataUrl} alt="Eyes Open" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                  </div>
                  <button 
                    onClick={() => handleDownloadPart(parsedAssetSheetParts.eyesOpenDataUrl, 'vtuber_eyes_open.png')} 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Download size={12} /> PNG保存
                  </button>
                </div>

                {/* Part 3: Eyes Closed */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                    😌 両目 (まばたき・閉じ)
                  </span>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={parsedAssetSheetParts.eyesClosedDataUrl} alt="Eyes Closed" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                  </div>
                  <button 
                    onClick={() => handleDownloadPart(parsedAssetSheetParts.eyesClosedDataUrl, 'vtuber_eyes_closed.png')} 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Download size={12} /> PNG保存
                  </button>
                </div>

                {/* Part 4: Mouth Open */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                    😮 口 (オープン・開口)
                  </span>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={parsedAssetSheetParts.mouthOpenDataUrl} alt="Mouth Open" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                  </div>
                  <button 
                    onClick={() => handleDownloadPart(parsedAssetSheetParts.mouthOpenDataUrl, 'vtuber_mouth_open.png')} 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Download size={12} /> PNG保存
                  </button>
                </div>

                {/* Part 5: Mouth Closed */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                    😐 口 (ニュートラル・閉じ)
                  </span>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3Crect x=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect y=\'8\' width=\'8\' height=\'8\' fill=\'%231e293b\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23334155\'/%3E%3C/svg%3E")', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={parsedAssetSheetParts.mouthClosedDataUrl} alt="Mouth Closed" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                  </div>
                  <button 
                    onClick={() => handleDownloadPart(parsedAssetSheetParts.mouthClosedDataUrl, 'vtuber_mouth_closed.png')} 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Download size={12} /> PNG保存
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default AssetSheetGenerator;
