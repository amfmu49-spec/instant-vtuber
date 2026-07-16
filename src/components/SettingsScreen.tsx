import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Camera, Upload, Key, Settings, Play } from 'lucide-react';
import { analyzeAvatarImage } from '../services/geminiService';

const SettingsScreen: React.FC = () => {
  const { 
    geminiApiKey, setGeminiApiKey, 
    baseImage, setBaseImage, 
    avatarCoords, setAvatarCoords,
    sensitivity, setSensitivity,
    customSkinColors, setCustomSkinColors,
    currentProfileName, setCurrentProfileName,
    profileList, saveProfile, loadProfile, deleteProfile,
    importProfileFromFile, exportProfileToFile,
    defaultProfileName, setDefaultProfileName
  } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>(currentProfileName || '');

  // デフォルトプロファイルが読み込まれたら自動的にメイン画面へ遷移する（1セッションに1回のみ）
  useEffect(() => {
    if (defaultProfileName && currentProfileName === defaultProfileName && !sessionStorage.getItem('hasAutoLoaded')) {
      sessionStorage.setItem('hasAutoLoaded', 'true');
      navigate('/main');
    }
  }, [defaultProfileName, currentProfileName, navigate]);

  const handleSaveNewProfile = () => {
    if (newProfileName.trim()) {
      saveProfile(newProfileName.trim());
      setNewProfileName('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBaseImage(reader.result as string);
        setAvatarCoords(null); // 画像が変わったら座標をリセット
        setProcessStatus('');
      };
      reader.readAsDataURL(file);
    }
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
    navigate('/main');
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
                <p>クリックして画像をアップロード</p>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/png, image/jpeg" 
            style={{ display: 'none' }} 
          />
        </div>

        {baseImage && (
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
