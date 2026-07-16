import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Camera, Upload, Key, Settings, Play, Sparkles } from 'lucide-react';
import { analyzeAvatarImage, generateCharacterImage, generateFreeCharacterImage } from '../services/geminiService';
import { readPsd } from 'ag-psd';
import { splitImageIntoHeadAndBody, parseGridSheet } from '../utils/avatarHelper';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { PsdLayerData } from '../store/AppContext';

const SettingsScreen: React.FC = () => {
  const { 
    geminiApiKey, setGeminiApiKey, 
    baseImage, setBaseImage, 
    originalGridImage, setOriginalGridImage,
    avatarCoords, setAvatarCoords,
    sensitivity, setSensitivity,
    customSkinColors, setCustomSkinColors,
    currentProfileName, setCurrentProfileName,
    profileList, saveProfile, loadProfile, deleteProfile,
    importProfileFromFile, exportProfileToFile,
    defaultProfileName, setDefaultProfileName,
    setPsdLayers, psdLayers
  } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>(currentProfileName || '');

  // AIアバター生成用の状態
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [neckY, setNeckY] = useState<number>(55);
  const [neckX, setNeckX] = useState<number>(50);
  const [removeWhiteBg, setRemoveWhiteBg] = useState<boolean>(true);
  const [imageGeneratorEngine, setImageGeneratorEngine] = useState<'free' | 'gemini'>('free');
  const [generateGridSheet, setGenerateGridSheet] = useState<boolean>(false);
  const [isProcessingGrid, setIsProcessingGrid] = useState<boolean>(false);

  // デフォルトプロファイルが読み込まれたら自動的にメイン画面へ遷移する（1セッションに1回のみ）
  useEffect(() => {
    if (defaultProfileName && currentProfileName === defaultProfileName && !sessionStorage.getItem('hasAutoLoaded')) {
      sessionStorage.setItem('hasAutoLoaded', 'true');
      navigate('/main');
    }
  }, [defaultProfileName, currentProfileName, navigate]);

  // プロファイルロード時にスライダー座標を同期
  useEffect(() => {
    if (avatarCoords) {
      if (avatarCoords.neckY !== undefined) {
        setNeckY(avatarCoords.neckY);
      }
      if (avatarCoords.neckX !== undefined) {
        setNeckX(avatarCoords.neckX);
      }
      if (avatarCoords.removeWhiteBg !== undefined) {
        setRemoveWhiteBg(avatarCoords.removeWhiteBg);
      }
    }
  }, [avatarCoords]);



  const handleSaveNewProfile = () => {
    // 保存前に、簡易2枚分割の場合は今の座標情報をavatarCoordsに記録する
    if (baseImage && !psdLayers) {
      setAvatarCoords({
        leftEye: null, rightEye: null, mouth: null,
        mouthState: 'closed', eyeState: 'open',
        neckY: neckY,
        neckX: neckX,
        removeWhiteBg: removeWhiteBg
      });
    }
    
    setTimeout(() => {
      if (newProfileName.trim()) {
        saveProfile(newProfileName.trim());
        setNewProfileName('');
      }
    }, 50);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.psd')) {
        setProcessStatus('PSDファイルを読み込んでいます...');
        setIsProcessing(true);
        try {
          const buffer = await file.arrayBuffer();
          const psd = readPsd(buffer, { skipLayerImageData: false, skipCompositeImageData: false });
          
          const makeCanvas = (node: any): HTMLCanvasElement | null => {
            if (node.canvas) return node.canvas;
            if (node.imageData) {
              const c = document.createElement('canvas');
              c.width = node.imageData.width;
              c.height = node.imageData.height;
              c.getContext('2d')?.putImageData(node.imageData, 0, 0);
              return c;
            }
            return null;
          };

          const extractLayers = (node: any, offsetX = 0, offsetY = 0): PsdLayerData[] => {
            let layers: PsdLayerData[] = [];
            let currentBlendMode = node.blendMode || 'source-over';
            const currentOpacity = node.opacity !== undefined ? node.opacity / 255 : 1;

            if (node.children && node.children.length > 0) {
              for (const child of node.children) {
                layers = layers.concat(extractLayers(child, offsetX + (node.left || 0), offsetY + (node.top || 0)));
              }
            } else {
              const canvas = makeCanvas(node);
              if (canvas) {
                layers.push({
                  name: node.name || 'layer',
                  canvas,
                  left: (node.left || 0) + offsetX,
                  top: (node.top || 0) + offsetY,
                  width: canvas.width,
                  height: canvas.height,
                  visible: node.hidden !== true,
                  blendMode: currentBlendMode,
                  opacity: currentOpacity
                });
              }
            }
            return layers;
          };
          
          let extractedLayers = extractLayers(psd);

          const psdWidth = psd.width || 0;
          const psdHeight = psd.height || 0;
          let bgSuffix = '';

          if (psdWidth > 0 && psdHeight > 0) {
            for (const layer of extractedLayers) {
              if (layer.name.startsWith('base') && layer.canvas) {
                if (layer.left <= 5 && layer.top <= 5 && 
                    layer.left + layer.width >= psdWidth - 5 && 
                    layer.top + layer.height >= psdHeight - 5) {
                  
                  const ctx = layer.canvas.getContext('2d');
                  if (ctx) {
                    try {
                      const w = layer.canvas.width;
                      const h = layer.canvas.height;
                      const c1 = ctx.getImageData(0, 0, 1, 1).data[3];
                      const c2 = ctx.getImageData(w - 1, 0, 1, 1).data[3];
                      const c3 = ctx.getImageData(0, h - 1, 1, 1).data[3];
                      const c4 = ctx.getImageData(w - 1, h - 1, 1, 1).data[3];

                      if (c1 > 100 && c2 > 100 && c3 > 100 && c4 > 100) {
                        bgSuffix = layer.name.replace('base', '');
                        break;
                      }
                    } catch (e) {
                      console.warn("Background detection getImageData failed", e);
                    }
                  }
                }
              }
            }
          }

          if (bgSuffix !== '') {
            extractedLayers.forEach(layer => {
              if (layer.name.endsWith(bgSuffix)) {
                layer.visible = false;
              }
            });
          }

          setPsdLayers(extractedLayers.reverse());
          
          if (extractedLayers.length === 0) {
            throw new Error('レイヤーが見つかりませんでした。');
          }
          
          if (psd.canvas) {
            setBaseImage(psd.canvas.toDataURL());
          } else if (extractedLayers.length > 0) {
            setBaseImage(extractedLayers[extractedLayers.length - 1].canvas?.toDataURL() || null);
          }
          
          setAvatarCoords(null);
          setProcessStatus(`✅ PSD読み込み成功！ (${extractedLayers.length}レイヤー)`);
        } catch (err: any) {
          console.error('PSD load error:', err);
          setProcessStatus('PSDの読み込みに失敗: ' + err.message);
          alert('PSDの読み込みに失敗しました。\n' + err.message);
        } finally {
          setIsProcessing(false);
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const srcUrl = reader.result as string;
          if (generateGridSheet) {
            setOriginalGridImage(srcUrl);
          } else {
            setOriginalGridImage(null);
          }
          setBaseImage(srcUrl);
          setPsdLayers(null);
          setAvatarCoords(null);
          setProcessStatus('');
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleProcessImage = async () => {
    if (!baseImage) return;
    if (!geminiApiKey) {
      alert('Gemini APIキーを入力してください。');
      return;
    }
    
    setIsProcessing(true);
    setProcessStatus('Gemini APIで画像を解析中...');
    
    try {
      const coords = await analyzeAvatarImage(geminiApiKey, baseImage);
      if (coords) {
        setAvatarCoords(coords);
        setProcessStatus('✅ 解析成功！（準備完了）');
      } else {
        setProcessStatus('解析に失敗しました。');
      }
    } catch (err: any) {
      console.error(err);
      alert(`APIエラーが発生しました: ${err.message || '詳細不明'}`);
      setProcessStatus('エラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateCharacter = async () => {
    if (imageGeneratorEngine === 'gemini' && !geminiApiKey) {
      alert('Gemini APIキーを入力してください。');
      return;
    }
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setProcessStatus('AI画像を生成しています...');
    try {
      let finalPrompt = aiPrompt;
      if (generateGridSheet) {
        finalPrompt = `${aiPrompt}, 3x3 sprite sheet grid of expressions, 9 panels: Row 1 (top): left is normal face (open eyes, closed mouth), middle is eyes closed (closed mouth), right is mouth A shape (open eyes). Row 2 (middle): left is mouth I shape (open eyes), middle is mouth U shape (open eyes), right is mouth E shape (open eyes). Row 3 (bottom): left is mouth O shape (open eyes), middle is smiling face, right is laughing face. Same character design consistency across all panels, solid flat white background, front-facing digital anime style.`;
      }

      let imgUrl = '';
      if (imageGeneratorEngine === 'free') {
        imgUrl = await generateFreeCharacterImage(finalPrompt);
      } else {
        imgUrl = await generateCharacterImage(geminiApiKey, finalPrompt);
      }
      setPsdLayers(null);
      setAvatarCoords(null);
      if (generateGridSheet) {
        setOriginalGridImage(imgUrl);
      } else {
        setOriginalGridImage(null);
      }
      setBaseImage(imgUrl);
      setProcessStatus('✅ AIアバター生成に成功しました！');
    } catch (err: any) {
      console.error(err);
      alert(`生成エラー: ${err.message || '詳細不明'}`);
      setProcessStatus('画像生成に失敗しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStart = () => {
    if (baseImage && !psdLayers) {
      const img = new Image();
      img.src = baseImage;
      img.onload = () => {
        const isGrid = generateGridSheet || !!originalGridImage;
        const layers = splitImageIntoHeadAndBody(img, neckY, removeWhiteBg, isGrid);
        setPsdLayers(layers);
        
        setAvatarCoords({
          leftEye: avatarCoords?.leftEye ?? null,
          rightEye: avatarCoords?.rightEye ?? null,
          mouth: avatarCoords?.mouth ?? null,
          mouthState: avatarCoords?.mouthState ?? 'closed',
          eyeState: avatarCoords?.eyeState ?? 'open',
          selectedEyeId: avatarCoords?.selectedEyeId,
          selectedMouthId: avatarCoords?.selectedMouthId,
          neckY: neckY,
          neckX: neckX,
          removeWhiteBg: removeWhiteBg
        });
        navigate('/main');
      };
    } else {
      if (avatarCoords) {
        setAvatarCoords({
          ...avatarCoords,
          neckY: neckY,
          neckX: neckX,
          removeWhiteBg: removeWhiteBg
        });
      }
      navigate('/main');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      
      <div className="glass-panel" style={{ flex: '1 1 400px', maxWidth: '500px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={24} /> 基本設定
        </h2>
        
        <div className="form-group">
          <label>Gemini API キー (パーツ自動生成用)</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Key size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
            </div>
            {geminiApiKey && (
              <button 
                onClick={() => {
                  if (confirm("APIキーを削除しますか？")) {
                    setGeminiApiKey('');
                  }
                }}
                className="button-secondary"
                style={{ padding: '0.75rem', color: '#ef4444', borderColor: '#ef4444', background: 'transparent' }}
                title="APIキーを削除"
              >
                削除
              </button>
            )}
          </div>
          <small style={{ color: '#64748b', display: 'block', marginTop: '0.5rem' }}>
            ※入力したAPIキーはブラウザにローカル保存されます。削除ボタンを押すまで保持されます。セキュリティ上、サーバー等には一切送信されません。
          </small>
        </div>


        <div className="form-group" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Sparkles size={18} style={{ color: '#a855f7' }} /> AIアバター自動生成
          </h3>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setImageGeneratorEngine('free')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: imageGeneratorEngine === 'free' ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              無料エンジン (キー不要)
            </button>
            <button
              onClick={() => setImageGeneratorEngine('gemini')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: imageGeneratorEngine === 'gemini' ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Gemini / Imagen 3
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>
            {imageGeneratorEngine === 'free' 
              ? "APIキー不要でアニメ風のアバター画像を自動生成します。（英語のプロンプトの方が上手く生成されます）"
              : "GeminiのImagen 3モデルで生成します。（APIキーとプロジェクトの課金連携が必要です）"
            }
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <textarea
              className="input-field"
              rows={2}
              placeholder={imageGeneratorEngine === 'free'
                ? "例: cute cat girl, blonde hair, wizard outfit, looking at camera"
                : "例: cute cat girl, blonde hair, wizard outfit"
              }
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              style={{ resize: 'none' }}
              disabled={imageGeneratorEngine === 'gemini' && !geminiApiKey}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="generate-grid-sheet"
                checked={generateGridSheet}
                onChange={(e) => setGenerateGridSheet(e.target.checked)}
                style={{ cursor: 'pointer', width: '1rem', height: '1rem' }}
              />
              <label htmlFor="generate-grid-sheet" style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1', userSelect: 'none' }}>
                🌟 表情シートとして作成（閉じ目・口開きの自動切り出し対応）
              </label>
            </div>

            <button
              onClick={handleGenerateCharacter}
              disabled={isGenerating || !aiPrompt.trim() || (imageGeneratorEngine === 'gemini' && !geminiApiKey)}
              className="button-primary"
              style={{ background: isGenerating || !aiPrompt.trim() || (imageGeneratorEngine === 'gemini' && !geminiApiKey) ? undefined : 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', border: 'none', width: '100%', padding: '0.75rem' }}
            >
              {isGenerating 
                ? 'アバター画像生成中...' 
                : (imageGeneratorEngine === 'free' ? '無料でAIキャラクターを生成' : 'AIキャラクターを生成する')
              }
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const fullPrompt = generateGridSheet
                    ? `${aiPrompt}, 3x3 sprite sheet grid of expressions, 9 panels: Row 1 (top): left is normal face (open eyes, closed mouth), middle is eyes closed (closed mouth), right is mouth A shape (open eyes). Row 2 (middle): left is mouth I shape (open eyes), middle is mouth U shape (open eyes), right is mouth E shape (open eyes). Row 3 (bottom): left is mouth O shape (open eyes), middle is smiling face, right is laughing face. Same character design consistency across all panels, solid flat white background, front-facing digital anime style.`
                    : `${aiPrompt}, cute japanese 2d anime illustration style, beautiful anime face, cell-shaded, flat colors, front-facing bust-up portrait, looking at the viewer. Clear neck line without any accessories, simple hairstyle. Solid flat white background.`;
                  window.open(`https://chatgpt.com/?q=${encodeURIComponent(fullPrompt)}`, '_blank');
                }}
                disabled={!aiPrompt.trim()}
                className="button-secondary"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', opacity: aiPrompt.trim() ? 1 : 0.5, cursor: aiPrompt.trim() ? 'pointer' : 'default' }}
              >
                💬 チャッピーで生成
              </button>
              <button
                type="button"
                onClick={() => {
                  const fullPrompt = generateGridSheet
                    ? `${aiPrompt}, 3x3 sprite sheet grid of expressions, 9 panels: Row 1 (top): left is normal face (open eyes, closed mouth), middle is eyes closed (closed mouth), right is mouth A shape (open eyes). Row 2 (middle): left is mouth I shape (open eyes), middle is mouth U shape (open eyes), right is mouth E shape (open eyes). Row 3 (bottom): left is mouth O shape (open eyes), middle is smiling face, right is laughing face. Same character design consistency across all panels, solid flat white background, front-facing digital anime style.`
                    : `${aiPrompt}, cute japanese 2d anime illustration style, beautiful anime face, cell-shaded, flat colors, front-facing bust-up portrait, looking at the viewer. Clear neck line without any accessories, simple hairstyle. Solid flat white background.`;
                  window.open(`https://www.bing.com/images/create?q=${encodeURIComponent(fullPrompt)}`, '_blank');
                }}
                disabled={!aiPrompt.trim()}
                className="button-secondary"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', opacity: aiPrompt.trim() ? 1 : 0.5, cursor: aiPrompt.trim() ? 'pointer' : 'default' }}
              >
                🎨 Bingで生成
              </button>
            </div>
            {imageGeneratorEngine === 'gemini' && !geminiApiKey && (
              <small style={{ color: '#ef4444' }}>※上の「基本設定」でGemini APIキーを入力してください。</small>
            )}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label>アバター画像 (ベースモデル)</label>
          
          <div 
            style={{ 
              border: '2px dashed rgba(255,255,255,0.2)', 
              borderRadius: '12px', 
              padding: '2rem', 
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.1)',
              transition: 'background 0.2s'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {baseImage ? (
              <img src={baseImage} alt="Base" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
            ) : (
              <div style={{ color: '#94a3b8' }}>
                <Upload size={32} style={{ margin: '0 auto 1rem' }} />
                <p>クリックして画像をアップロード (PSD / PNG / JPEG)</p>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="*/*" 
            style={{ display: 'none' }} 
          />
        </div>

        {baseImage && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setGenerateGridSheet(false);
                setOriginalGridImage(null);
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: !generateGridSheet ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🖼 通常の1枚絵
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerateGridSheet(true);
                if (baseImage) {
                  setOriginalGridImage(baseImage);
                }
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: generateGridSheet ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📊 3x3表情シート
            </button>
          </div>
        )}

        {baseImage && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                const promptText = `Please generate a 3x3 expression grid sheet of the exact same character shown in this reference image. Keep the character design, hair, clothes, and colors completely identical. 9 panels:
- Row 1 (top): left is normal face (open eyes, closed mouth), middle is eyes closed (closed mouth), right is mouth "A" shape (open eyes)
- Row 2 (middle): left is mouth "I" shape (open eyes), middle is mouth "U" shape (open eyes), right is mouth "E" shape (open eyes)
- Row 3 (bottom): left is mouth "O" shape (open eyes), middle is smiling face, right is laughing face
Same character design consistency across all panels, solid flat white background, front-facing digital anime style.`;
                navigator.clipboard.writeText(promptText);
                alert("「1枚絵から3x3表情シートを作るプロンプト」をクリップボードにコピーしました！\n\nこの後ChatGPTが開きますので、同じ画像ファイルをアップロードし、コピーしたテキストを貼り付けて送信してください。");
                window.open("https://chatgpt.com/", "_blank");
              }}
              className="button-secondary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', border: '1px dashed #a855f7', color: '#c084fc' }}
            >
              🪄 この画像から3x3表情シートを作成 (チャッピー用)
            </button>
          </div>
        )}

        {baseImage && psdLayers && (
          <div style={{ marginTop: '1.5rem' }}>
            <button 
              className="button-secondary" 
              style={{ width: '100%', marginBottom: '1rem', backgroundColor: processStatus.includes('成功') ? '#10b981' : undefined, color: processStatus.includes('成功') ? 'white' : undefined, borderColor: processStatus.includes('成功') ? '#10b981' : undefined }}
              onClick={handleProcessImage}
              disabled={isProcessing}
            >
              {isProcessing || processStatus.includes('成功') ? processStatus : <span>Gemini APIでパーツを<br />自動生成する</span>}
            </button>
          </div>
        )}

        {baseImage && !psdLayers && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              首の分割位置（スライサー）
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              スライダーを動かして、赤線をキャラクターの「あごの真下（首）」の位置に合わせてください。
            </p>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <div style={{ 
                position: 'relative', 
                display: 'inline-block',
                width: '180px',
                height: '180px',
                overflow: 'hidden',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.15)'
              }}>
                <img 
                  src={baseImage} 
                  alt="Neck adjustment" 
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: generateGridSheet ? '300%' : '100%', 
                    height: generateGridSheet ? '300%' : '100%', 
                    display: 'block',
                    objectFit: 'contain'
                  }} 
                />
                {/* 首の切断位置線 (上下赤線) */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: `${neckY}%`, 
                    left: 0, 
                    right: 0, 
                    height: '2px', 
                    background: '#ef4444', 
                    boxShadow: '0 0 8px #ef4444',
                    pointerEvents: 'none',
                    zIndex: 10
                  }} 
                />
                {/* 首の回転中心線 (左右紫線) */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    bottom: 0, 
                    left: `${neckX}%`, 
                    width: '2px', 
                    background: '#a855f7', 
                    boxShadow: '0 0 8px #a855f7',
                    pointerEvents: 'none',
                    zIndex: 10
                  }} 
                />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>首の高さ (上下位置)</span> 
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{neckY}%</span>
              </label>
              <input 
                type="range" 
                min="10" max="90" step="1"
                value={neckY}
                onChange={(e) => setNeckY(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>首の回転軸 (左右位置)</span> 
                <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{neckX}%</span>
              </label>
              <input 
                type="range" 
                min="10" max="90" step="1"
                value={neckX}
                onChange={(e) => setNeckX(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <input 
                type="checkbox" 
                id="remove-white-bg"
                checked={removeWhiteBg}
                onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="remove-white-bg" style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
                白背景を自動的に透明化する
              </label>
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label>まばたき感度 ({sensitivity.eyeClose})</label>
          <input 
            type="range" 
            min="0.1" max="0.5" step="0.05"
            value={sensitivity.eyeClose}
            onChange={(e) => setSensitivity({ ...sensitivity, eyeClose: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group">
          <label>口の開閉感度 ({sensitivity.mouthOpen})</label>
          <input 
            type="range" 
            min="0.05" max="0.3" step="0.01"
            value={sensitivity.mouthOpen}
            onChange={(e) => setSensitivity({ ...sensitivity, mouthOpen: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <button
          onClick={handleStart}
          disabled={!baseImage}
          className="button-primary"
          style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
        >
          <Play size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          トラッキング開始<br />（映像は非公開）
        </button>

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 キャラクター管理 {currentProfileName && <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 'normal' }}>(現在: {currentProfileName})</span>}
          </h3>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="新しいキャラクター名" 
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              className="button-secondary"
              onClick={handleSaveNewProfile}
              disabled={!baseImage || !newProfileName.trim()}
              style={{ padding: '0.5rem 1rem' }}
            >
              新規保存
            </button>
            
            <button 
              className="button-secondary"
              onClick={() => jsonInputRef.current?.click()}
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="ファイルから読み込み"
            >
              <Upload size={16} /> 読込
            </button>
            <input 
              type="file" 
              ref={jsonInputRef} 
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  importProfileFromFile(e.target.files[0]);
                  e.target.value = '';
                }
              }} 
              accept=".json" 
              style={{ display: 'none' }} 
            />
          </div>

          {profileList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>保存済みのキャラクターリスト</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select 
                  className="input-field"
                  value={currentProfileName || ''}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected) loadProfile(selected);
                  }}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  <option value="" disabled>キャラクターを選択...</option>
                  {profileList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                
                <button 
                  className="button-secondary"
                  onClick={() => currentProfileName && exportProfileToFile(currentProfileName)}
                  disabled={!currentProfileName}
                  style={{ padding: '0.5rem', display: 'flex', alignItems: 'center' }}
                  title="ファイルへ書き出し"
                >
                  ↓
                </button>
                
                <button 
                  onClick={() => {
                    if (currentProfileName && window.confirm(`本当に「${currentProfileName}」を削除しますか？`)) {
                      deleteProfile(currentProfileName);
                    }
                  }} 
                  disabled={!currentProfileName}
                  style={{ padding: '0.5rem', backgroundColor: 'transparent', border: '1px solid #ef4444', color: currentProfileName ? '#ef4444' : '#666', borderRadius: '6px', cursor: currentProfileName ? 'pointer' : 'default' }}
                  title="現在選択中のキャラクターを削除"
                >
                  削除
                </button>
              </div>
            </div>
          )}


          {profileList.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#cbd5e1' }}>
                起動時に自動で開くキャラクター
              </label>
              <select
                className="input-field"
                value={defaultProfileName || ''}
                onChange={(e) => setDefaultProfileName(e.target.value || null)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">（指定なし）毎回選ぶ</option>
                {profileList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

      </div>
      
      <div className="glass-panel" style={{ flex: '1 1 300px', maxWidth: '400px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Camera size={20} /> プライバシーとセキュリティ
        </h3>
        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6' }}>
          このアプリは<strong>プライバシーを最優先</strong>に設計されています。
        </p>
        <ul style={{ color: '#cbd5e1', fontSize: '0.9rem', paddingLeft: '1.5rem', marginTop: '1rem', lineHeight: '1.8' }}>
          <li>カメラ映像は顔の座標（メッシュ）抽出のみに使用され、画面上に映像自体がレンダリングされることは一切ありません。</li>
          <li>そのため、バグや配信ソフトの操作ミスによる「顔バレ」事故を物理的に防ぐことができます。</li>
          <li>すべての処理（MediaPipeによる顔認識）はブラウザのローカル内で完結し、映像がサーバーに送信されることはありません。</li>
        </ul>
      </div>

    </div>
  );
};

export default SettingsScreen;
