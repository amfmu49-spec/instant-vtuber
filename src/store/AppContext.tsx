import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';

export interface AvatarCoords {
  leftEye: { x: number; y: number; width: number; height: number } | null;
  rightEye: { x: number; y: number; width: number; height: number } | null;
  mouth: { x: number; y: number; width: number; height: number } | null;
  mouthState: 'open' | 'closed';
  eyeState: 'open' | 'closed';
  selectedEyeId?: string;
  selectedMouthId?: string;
  skinColorHex?: string;
  lashColorHex?: string;
  styleParams?: {
    leftEyeTilt: number;
    rightEyeTilt: number;
    lashColor: string;
    lashThickness: number;
    hasFangs: boolean;
    fangLength: number;
    mouthInnerColor: string;
    tongueColor: string;
  };
  neckY?: number; // 0 to 100 percent
  removeWhiteBg?: boolean;
}

export interface PsdLayerData {
  name: string;
  canvas?: HTMLCanvasElement;
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
  blendMode?: string;
  opacity?: number;
}

interface AppState {
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  baseImage: string | null;
  setBaseImage: (dataUrl: string | null) => void;
  characterImage: string | null;
  setCharacterImage: (dataUrl: string | null) => void;
  psdLayers: PsdLayerData[] | null;
  setPsdLayers: (layers: PsdLayerData[] | null) => void;
  avatarCoords: AvatarCoords | null;
  setAvatarCoords: (coords: AvatarCoords | null) => void;
  sensitivity: {
    eyeClose: number;
    mouthOpen: number;
  };
  setSensitivity: (s: { eyeClose: number; mouthOpen: number }) => void;
  customSkinColors: { leftEye: string | null; rightEye: string | null; mouth: string | null };
  setCustomSkinColors: (colors: { leftEye: string | null; rightEye: string | null; mouth: string | null }) => void;
  currentProfileName: string | null;
  setCurrentProfileName: (name: string | null) => void;
  profileList: string[];
  saveProfile: (name?: string) => Promise<void>;
  loadProfile: (name: string) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  exportProfileToFile: (name: string) => Promise<void>;
  importProfileFromFile: (file: File) => Promise<void>;
  defaultProfileName: string | null;
  setDefaultProfileName: (name: string | null) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

// ヘルパーの遅延インポート用にヘルパー関数を定義
import { splitImageIntoHeadAndBody } from '../utils/avatarHelper';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  const [baseImage, setBaseImageState] = useState<string | null>(null);
  const [characterImage, setCharacterImageState] = useState<string | null>(null);
  const [psdLayers, setPsdLayersState] = useState<PsdLayerData[] | null>(null);
  const [avatarCoords, setAvatarCoordsState] = useState<AvatarCoords | null>(null);
  const [customSkinColors, setCustomSkinColorsState] = useState<{ leftEye: string | null; rightEye: string | null; mouth: string | null }>({ leftEye: null, rightEye: null, mouth: null });

  const [sensitivity, setSensitivity] = useState({ eyeClose: 0.4, mouthOpen: 0.1 });

  const handleSetApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const setBaseImage = (dataUrl: string | null) => {
    setBaseImageState(dataUrl);
  };

  const setCharacterImage = (dataUrl: string | null) => {
    setCharacterImageState(dataUrl);
  };

  const setPsdLayers = (layers: PsdLayerData[] | null) => {
    setPsdLayersState(layers);
  };

  const setAvatarCoords = (coords: AvatarCoords | null) => {
    setAvatarCoordsState(coords);
  };

  const setCustomSkinColors = (colors: { leftEye: string | null; rightEye: string | null; mouth: string | null }) => {
    setCustomSkinColorsState(colors);
  };

  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null);
  const [defaultProfileName, setDefaultProfileNameState] = useState<string | null>(null);
  
  // 初期ロード時にプロファイルリストを取得
  const [profileList, setProfileList] = useState<string[]>([]);

  const setDefaultProfileName = async (name: string | null) => {
    setDefaultProfileNameState(name);
    if (name) {
      await set('vtuber_default_profile', name);
    } else {
      await del('vtuber_default_profile');
    }
  };

  const applyProfileData = (data: any) => {
    if (data.baseImage) setBaseImageState(data.baseImage);
    if (data.characterImage) setCharacterImageState(data.characterImage);
    else setCharacterImageState(null);
    if (data.avatarCoords !== undefined) {
      setAvatarCoordsState(data.avatarCoords);
      if (data.avatarCoords && data.avatarCoords.neckY !== undefined && data.baseImage) {
        const img = new Image();
        img.src = data.baseImage;
        img.onload = () => {
          const layers = splitImageIntoHeadAndBody(img, data.avatarCoords.neckY, data.avatarCoords.removeWhiteBg !== false);
          setPsdLayersState(layers);
        };
      } else {
        setPsdLayersState(null);
      }
    }
    if (data.customSkinColors) setCustomSkinColorsState(data.customSkinColors);
    if (data.sensitivity) setSensitivity(data.sensitivity);
  };

  useEffect(() => {
    const initDB = async () => {
      let list = await get<string[]>('vtuber_profile_list');
      
      // localStorageからのマイグレーション
      if (!list) {
        try {
          const localListStr = localStorage.getItem('vtuber_profile_list');
          if (localListStr) {
            list = JSON.parse(localListStr);
            if (list && list.length > 0) {
              await set('vtuber_profile_list', list);
              for (const name of list) {
                const dataStr = localStorage.getItem(`vtuber_profile_${name}`);
                if (dataStr) {
                  await set(`vtuber_profile_${name}`, JSON.parse(dataStr));
                }
              }
              console.log('Migrated data from localStorage to IndexedDB');
            }
          }
        } catch (e) {
          console.error('Migration failed', e);
        }
      }
      
      if (list) {
        setProfileList(list);
      }

      // デフォルトプロファイルの読み込み
      const defaultName = await get<string>('vtuber_default_profile');
      if (defaultName && (!list || list.includes(defaultName))) {
        setDefaultProfileNameState(defaultName);
        const data = await get<any>(`vtuber_profile_${defaultName}`);
        if (data) {
          applyProfileData(data);
          setCurrentProfileName(defaultName);
          console.log(`Auto-loaded default profile: ${defaultName}`);
        }
      }
    };
    initDB();
  }, []);

  const saveProfile = async (name?: string) => {
    const targetName = name || currentProfileName;
    if (!targetName) {
      alert('プロファイル名が指定されていません。');
      return;
    }

    try {
      const profileData = {
        baseImage,
        characterImage,
        avatarCoords,
        customSkinColors,
        sensitivity
      };
      
      await set(`vtuber_profile_${targetName}`, profileData);
      
      if (!profileList.includes(targetName)) {
        const newList = [...profileList, targetName];
        setProfileList(newList);
        await set('vtuber_profile_list', newList);
      }
      
      setCurrentProfileName(targetName);
      alert(`「${targetName}」の設定を保存しました！`);
    } catch (e: any) {
      alert('保存に失敗しました。');
      console.error(e);
    }
  };

  const loadProfile = async (name: string) => {
    try {
      const data = await get<any>(`vtuber_profile_${name}`);
      if (!data) {
        alert(`「${name}」の設定が見つかりませんでした。`);
        return;
      }
      
      applyProfileData(data);
      
      setCurrentProfileName(name);
      alert(`「${name}」の設定をロードしました！`);
    } catch (e) {
      alert('ロードに失敗しました。データが破損している可能性があります。');
      console.error(e);
    }
  };

  const deleteProfile = async (name: string) => {
    try {
      await del(`vtuber_profile_${name}`);
      const newList = profileList.filter(p => p !== name);
      setProfileList(newList);
      await set('vtuber_profile_list', newList);
      
      if (currentProfileName === name) {
        setCurrentProfileName(null);
        setBaseImageState(null);
        setAvatarCoordsState(null);
      }
      alert(`「${name}」を削除しました。`);
    } catch (e) {
      alert('削除に失敗しました。');
      console.error(e);
    }
  };

  const exportProfileToFile = async (name: string) => {
    try {
      const data = await get<any>(`vtuber_profile_${name}`);
      if (!data) {
        alert(`「${name}」のデータが見つかりません。`);
        return;
      }
      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vtuber_profile_${name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('書き出しに失敗しました。');
      console.error(e);
    }
  };

  const importProfileFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.baseImage) {
        alert('無効なプロファイルデータです。');
        return;
      }
      
      let name = file.name.replace('vtuber_profile_', '').replace('.json', '');
      const newName = prompt('読み込むキャラクター名を入力してください', name);
      if (!newName) return;
      
      await set(`vtuber_profile_${newName}`, data);
      
      if (!profileList.includes(newName)) {
        const newList = [...profileList, newName];
        setProfileList(newList);
        await set('vtuber_profile_list', newList);
      }
      
      await loadProfile(newName);
    } catch (e) {
      alert('読み込みに失敗しました。対応していないファイルか、データが破損しています。');
      console.error(e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        geminiApiKey,
        setGeminiApiKey: handleSetApiKey,
        baseImage,
        setBaseImage,
        characterImage,
        setCharacterImage,
        psdLayers,
        setPsdLayers,
        avatarCoords,
        setAvatarCoords,
        sensitivity,
        setSensitivity,
        customSkinColors,
        setCustomSkinColors,
        currentProfileName,
        setCurrentProfileName,
        profileList,
        saveProfile,
        loadProfile,
        deleteProfile,
        exportProfileToFile,
        importProfileFromFile,
        defaultProfileName,
        setDefaultProfileName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

