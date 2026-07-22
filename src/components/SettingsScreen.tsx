import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Camera, Upload, Key, Settings, Play } from 'lucide-react';
import { analyzeAvatarImage } from '../services/geminiService';
import { readPsd } from 'ag-psd';
import { splitImageIntoHeadAndBody } from '../utils/avatarHelper';
import type { PsdLayerData } from '../store/AppContext';

import AssetUpload169 from './AssetUpload169';
import AssetSheetGenerator from './AssetSheetGenerator';
import { Sparkles, SlidersHorizontal, UploadCloud } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'generator'>('upload');

  // デフォルトプロファイルが読み込まれたら自動的にメイン画面へ遷移する（1セッションに1回のみ）
  useEffect(() => {
    if (defaultProfileName && currentProfileName === defaultProfileName && !sessionStorage.getItem('hasAutoLoaded')) {
      sessionStorage.setItem('hasAutoLoaded', 'true');
      navigate('/main');
    }
  }, [defaultProfileName, currentProfileName, navigate]);

  const handleSaveNewProfile = () => {
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
          setOriginalGridImage(null);
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



  const handleStart = () => {
    if (baseImage && !psdLayers && !avatarCoords) {
      setAvatarCoords({
        leftEye: null,
        rightEye: null,
        mouth: null,
        mouthState: 'closed',
        eyeState: 'open',
        neckY: 100,
        neckX: 50,
        removeWhiteBg: false
      });
    }
    navigate('/main');
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '1rem', boxSizing: 'border-box' }}>
      {/* Direct upload content - no tabs */}
      <AssetUpload169 />
    </div>
  );
};

export default SettingsScreen;
