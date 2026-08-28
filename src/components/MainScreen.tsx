import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { parseGridSheet, splitImageIntoHeadAndBody } from '../utils/avatarHelper';
import { ArrowLeft, Monitor, Settings2, X, Save, Download } from 'lucide-react';

const getVowelsFromText = (text: string): ('a' | 'i' | 'u' | 'e' | 'o' | null)[] => {
  const chars = text.split('');
  return chars.map(char => {
    if (/[あかさたなはまやらわアカサタナハマヤラワガザダバパぁゃゎ]/.test(char)) return 'a';
    if (/[いきしちにひみりイキシチニヒミリギジヂビピぃ]/.test(char)) return 'i';
    if (/[うくすつぬふむゆるウクスツヌフムユルグズヅブプぅゅ]/.test(char)) return 'u';
    if (/[えけせてねへめれエケセテネヘメレゲゼデベペぇ]/.test(char)) return 'e';
    if (/[おこそとのほもよろオコソトノホモヨロゴゾドボポぉょ]/.test(char)) return 'o';
    if (/[んン]/.test(char)) return null; 
    return null; 
  });
};



const MainScreen: React.FC = () => {
  const { baseImage, setBaseImage, originalGridImage, sensitivity, setSensitivity, avatarCoords, setAvatarCoords, customSkinColors, setCustomSkinColors, saveProfile, currentProfileName, psdLayers, setPsdLayers, parsedAssetSheetParts, setParsedAssetSheetParts, whiteThreshold, setWhiteThreshold, removeWhiteBg, setRemoveWhiteBg } = useAppContext();
  const navigate = useNavigate();

  const handleSaveToBrowser = () => {
    const input = prompt('キャラクターの保存名を入力してください (例: MyAvatar):', currentProfileName || '');
    if (input === null) return;
    const name = input.trim();
    if (!name) {
      alert('保存名が入力されていません。');
      return;
    }
    saveProfile(name);
    alert(`キャラクター「${name}」をブラウザに保存しました！最初の画面からロードできます。`);
  };

  const handleExportCharacter = () => {
    try {
      const profileData = {
        baseImage,
        originalGridImage,
        avatarCoords,
        customSkinColors,
        sensitivity,
        parsedAssetSheetParts
      };
      const json = JSON.stringify(profileData);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const charName = currentProfileName || 'character';
      a.download = `vtuber_char_${charName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('設定の保存に失敗しました。');
      console.error(e);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [bgColor, setBgColor] = useState('#00ff00');
  const [showTools, setShowTools] = useState(false);
  const showToolsRef = useRef(showTools);
  const [hasSetDefaultBg, setHasSetDefaultBg] = useState(false);

  const [modelOffset, setModelOffset] = useState({ x: 0, y: 0 });
  const [modelScale, setModelScale] = useState(1.30);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [modelDragStart, setModelDragStart] = useState({ px: 0, py: 0, ox: 0, oy: 0 });

  const modelOffsetRef = useRef(modelOffset);
  const modelScaleRef = useRef(modelScale);

  useEffect(() => {
    modelOffsetRef.current = modelOffset;
  }, [modelOffset]);

  useEffect(() => {
    modelScaleRef.current = modelScale;
  }, [modelScale]);

  const [mouthControlSource, setMouthControlSource] = useState<'camera' | 'audio'>('camera');
  const [audioMultiplier, setAudioMultiplier] = useState<number>(5.0);

  const mouthControlSourceRef = useRef<'camera' | 'audio'>('camera');
  const audioMultiplierRef = useRef<number>(5.0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const volumeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    mouthControlSourceRef.current = mouthControlSource;
    if (mouthControlSource === 'audio') {
      const initAudio = async () => {
        try {
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
          }
          if (audioContextRef.current) {
            await audioContextRef.current.close().catch(() => {});
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyserRef.current = analyser;

          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const analyze = () => {
            if (mouthControlSourceRef.current !== 'audio') return;
            analyser.getByteTimeDomainData(dataArray);

            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            volumeRef.current = volumeRef.current * 0.4 + rms * 0.6;
            animationFrameIdRef.current = requestAnimationFrame(analyze);
          };
          analyze();
        } catch (err) {
          console.error("Microphone tracking init failed:", err);
          alert("マイクの許可が得られなかったか、デバイスが使用中です。カメラ認識に戻ります。");
          setMouthControlSource('camera');
        }
      };
      initAudio();
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      volumeRef.current = 0;
    }

    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [mouthControlSource]);

  useEffect(() => {
    audioMultiplierRef.current = audioMultiplier;
  }, [audioMultiplier]);

  const assetSheetImagesRef = useRef<{
    eyesOpen: HTMLImageElement | null;
    eyesClosed: HTMLImageElement | null;
    leftEyeOpen: HTMLImageElement | null;
    rightEyeOpen: HTMLImageElement | null;
    leftEyeClosed: HTMLImageElement | null;
    rightEyeClosed: HTMLImageElement | null;
    mouthOpen: HTMLImageElement | null;
    mouthClosed: HTMLImageElement | null;
  }>({
    eyesOpen: null,
    eyesClosed: null,
    leftEyeOpen: null,
    rightEyeOpen: null,
    leftEyeClosed: null,
    rightEyeClosed: null,
    mouthOpen: null,
    mouthClosed: null
  });

  const rekeyImages = (threshold: number, setBg: boolean = false) => {
    if (!parsedAssetSheetParts || !parsedAssetSheetParts._originalSheetDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const fullWidth = img.naturalWidth || img.width;
      const fullHeight = img.naturalHeight || img.height;
      const halfWidth = Math.floor(fullWidth / 2);

      if (setBg) {
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 1;
          tempCanvas.height = 1;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
            const p = tempCtx.getImageData(0, 0, 1, 1).data;
            if (p[3] > 0) {
              const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
              setBgColor(hex);
            } else {
              setBgColor('#ffffff');
            }
          }
        } catch (e) {
          console.error("Failed to sample original background color:", e);
        }
      }

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = halfWidth;
      baseCanvas.height = fullHeight;
      const baseCtx = baseCanvas.getContext('2d');
      if (baseCtx) {
        baseCtx.drawImage(img, 0, 0, halfWidth, fullHeight, 0, 0, halfWidth, fullHeight);
        if (removeWhiteBg) {
          const imgData = baseCtx.getImageData(0, 0, halfWidth, fullHeight);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
              data[i + 3] = 0;
            }
          }
          baseCtx.putImageData(imgData, 0, 0);
        }
      }
      baseFaceCanvasRef.current = baseCanvas;

      const extractKeyedQuadrant = (
        cropBox: { x: number, y: number, width: number, height: number } | null,
        defaultRelMinX: number,
        defaultRelMaxX: number,
        defaultRelMinY: number,
        defaultRelMaxY: number
      ): HTMLImageElement => {
        let qX, qY, qW, qH;
        if (cropBox) {
          qX = halfWidth + Math.floor(cropBox.x * halfWidth);
          qY = Math.floor(cropBox.y * fullHeight);
          qW = Math.max(1, Math.floor(cropBox.width * halfWidth));
          qH = Math.max(1, Math.floor(cropBox.height * fullHeight));
        } else {
          qX = halfWidth + Math.floor(defaultRelMinX * halfWidth);
          qY = Math.floor(defaultRelMinY * fullHeight);
          qW = Math.max(1, Math.floor((defaultRelMaxX - defaultRelMinX) * halfWidth));
          qH = Math.max(1, Math.floor((defaultRelMaxY - defaultRelMinY) * fullHeight));
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = qW;
        tempCanvas.height = qH;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(img, qX, qY, qW, qH, 0, 0, qW, qH);
          if (removeWhiteBg) {
            const imgData = tempCtx.getImageData(0, 0, qW, qH);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
                data[i + 3] = 0;
              }
            }
            tempCtx.putImageData(imgData, 0, 0);
          }
        }
        const outImg = new Image();
        outImg.src = tempCanvas.toDataURL();
        return outImg;
      };

      const eyesOpen = extractKeyedQuadrant(
        parsedAssetSheetParts.eyesOpenCrop || null,
        0.0, 0.5, 0.0, 0.5
      );
      const eyesClosed = extractKeyedQuadrant(
        parsedAssetSheetParts.eyesClosedCrop || null,
        0.5, 1.0, 0.0, 0.5
      );
      const mouthOpen = extractKeyedQuadrant(
        parsedAssetSheetParts.mouthOpenCrop || null,
        0.0, 0.5, 0.5, 1.0
      );
      const mouthClosed = extractKeyedQuadrant(
        parsedAssetSheetParts.mouthClosedCrop || null,
        0.5, 1.0, 0.5, 1.0
      );

      eyesOpen.onload = () => { assetSheetImagesRef.current.eyesOpen = eyesOpen; };
      eyesClosed.onload = () => { assetSheetImagesRef.current.eyesClosed = eyesClosed; };
      mouthOpen.onload = () => { assetSheetImagesRef.current.mouthOpen = mouthOpen; };
      mouthClosed.onload = () => { assetSheetImagesRef.current.mouthClosed = mouthClosed; };

      assetSheetImagesRef.current.leftEyeOpen = eyesOpen;
      assetSheetImagesRef.current.rightEyeOpen = eyesOpen;
      assetSheetImagesRef.current.leftEyeClosed = eyesClosed;
      assetSheetImagesRef.current.rightEyeClosed = eyesClosed;

    };
    img.src = parsedAssetSheetParts._originalSheetDataUrl;
  };

  useEffect(() => {
    if (parsedAssetSheetParts) {
      rekeyImages(whiteThreshold, !hasSetDefaultBg);
      setHasSetDefaultBg(true);
    } else {
      assetSheetImagesRef.current = {};
    }
  }, [parsedAssetSheetParts]);
  
  useEffect(() => { 
    showToolsRef.current = showTools; 
    if (showTools) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showTools]);

  const [selectedPart, setSelectedPart] = useState<'leftEye' | 'rightEye' | 'mouth' | null>(null);
  const [isPickingColor, setIsPickingColor] = useState<'leftEye' | 'rightEye' | 'mouth' | null>(null);
  const [partScales, setPartScales] = useState<{ leftEye: number; rightEye: number; mouth: number }>({ leftEye: 1, rightEye: 1, mouth: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragScreenPos, setDragScreenPos] = useState<{x: number, y: number} | null>(null);
  // Refs so the animation loop inside useEffect can read current drag state
  const isDraggingRef = useRef(false);
  const selectedPartRef = useRef<'leftEye' | 'rightEye' | 'mouth' | null>(null);
  const partScalesRef = useRef(partScales);
  // Handle-delta drag tracking
  const [handleDragStart, setHandleDragStart] = useState<{px:number,py:number,ox:number,oy:number}|null>(null);
  // Loupe (magnifying eyedropper)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loupePos, setLoupePos] = useState<{x:number,y:number}|null>(null);
  const [loupeSampleColor, setLoupeSampleColor] = useState('#ffffff');
  
  // Parts Library & Change Feature
  const [partsLibrary, setPartsLibrary] = useState<{ eyes: any[], mouths: any[] } | null>(null);
  const [candidateSelector, setCandidateSelector] = useState<'leftEye' | 'rightEye' | 'mouth' | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}parts/library.json`).then(r => r.json()).then(setPartsLibrary).catch(() => {});
  }, []);
  
  const [sampledColors, setSampledColors] = useState<{ leftEye: string, rightEye: string, mouth: string }>({ leftEye: '#ffcccc', rightEye: '#ffcccc', mouth: '#ffcccc' });
  const sampledColorsRef = useRef<{ leftEye: string, rightEye: string, mouth: string }>({ leftEye: '#ffcccc', rightEye: '#ffcccc', mouth: '#ffcccc' });
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [ttsText, setTtsText] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const isSpeakingRef = useRef(isSpeaking);
  const ttsVowelsRef = useRef<('a' | 'i' | 'u' | 'e' | 'o' | null)[]>([]);
  const ttsStartTimeRef = useRef<number>(0);
  const voicevoxVoicesRef = useRef<any[]>([]);

  const selectedEyeImgRef = useRef<HTMLImageElement | null>(null);
  const selectedMouthImgRef = useRef<HTMLImageElement | null>(null);
  const selectedMouthClosedImgRef = useRef<HTMLImageElement | null>(null);
  const gridExpressionCanvasesRef = useRef<any>(null);
  const baseFaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load and tint SVG parts dynamically
  useEffect(() => {
    const loadSvg = async (filename: string, replacements: Record<string, string>) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}parts/${filename}.svg`);
        let svgText = await res.text();
        for (const [key, value] of Object.entries(replacements)) {
            // Replace literal strings like 'currentColor' and 'var(--mouth-bg, #661111)'
            svgText = svgText.split(key).join(value);
        }
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        return new Promise<HTMLImageElement>(r => {
           img.onload = () => r(img);
        });
      } catch (e) {
        console.error("Failed to load SVG part:", filename, e);
        return null;
      }
    };

    if (avatarCoords?.selectedEyeId) {
        loadSvg(avatarCoords.selectedEyeId, {
          'currentColor': avatarCoords.lashColorHex || '#222222'
        }).then(img => { if (img) selectedEyeImgRef.current = img; });
    } else {
        selectedEyeImgRef.current = null;
    }
    if (avatarCoords?.selectedMouthId) {
        // 開いた口
        loadSvg(avatarCoords.selectedMouthId, {
          'currentColor': avatarCoords.lashColorHex || '#222222',
          'var(--mouth-bg, #661111)': '#6b1b1b',
          'var(--mouth-bg, #441111)': '#441111',
          'var(--tongue-color, #ff6666)': '#b54141',
        }).then(img => { if (img) selectedMouthImgRef.current = img; });

        // 閉じた口（中身が透明）
        loadSvg(avatarCoords.selectedMouthId, {
          'currentColor': avatarCoords.lashColorHex || '#222222',
          'var(--mouth-bg, #661111)': 'transparent',
          'var(--mouth-bg, #441111)': 'transparent',
          'var(--tongue-color, #ff6666)': 'transparent',
        }).then(img => { if (img) selectedMouthClosedImgRef.current = img; });
    } else {
        selectedMouthImgRef.current = null;
        selectedMouthClosedImgRef.current = null;
    }
  }, [avatarCoords]);
  
  interface VoiceVoxSpeaker {
    name: string;
    speaker_uuid: string;
    styles: { name: string; id: number }[];
  }
  const [voiceVoxSpeakers, setVoiceVoxSpeakers] = useState<VoiceVoxSpeaker[]>([]);
  const [selectedVoiceVoxStyleId, setSelectedVoiceVoxStyleId] = useState<number | null>(null);
  const [useVoiceVox, setUseVoiceVox] = useState<boolean>(false);
  const [isVoiceVoxAvailable, setIsVoiceVoxAvailable] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const avatarCoordsRef = useRef(avatarCoords);
  const sensitivityRef = useRef(sensitivity);
  const customSkinColorsRef = useRef(customSkinColors);
  const psdLayersRef = useRef(psdLayers);
  useEffect(() => {
    avatarCoordsRef.current = avatarCoords;
    sensitivityRef.current = sensitivity;
    customSkinColorsRef.current = customSkinColors;
    partScalesRef.current = partScales;
    psdLayersRef.current = psdLayers;
  }, [avatarCoords, sensitivity, customSkinColors, partScales, psdLayers]);

  // Ensure default coordinates are set if null (specifically for 3x3 grid mode to enable tuning panel)
  useEffect(() => {
    if (baseImage && avatarCoords) {
      if (!avatarCoords.leftEye || !avatarCoords.rightEye || !avatarCoords.mouth) {
        setAvatarCoords({
          ...avatarCoords,
          leftEye: avatarCoords.leftEye || { x: 0.35, y: 0.45, width: 0.05, height: 0.04 },
          rightEye: avatarCoords.rightEye || { x: 0.65, y: 0.45, width: 0.05, height: 0.04 },
          mouth: avatarCoords.mouth || { x: 0.5, y: 0.65, width: 0.06, height: 0.04 }
        });
      }
    }
  }, [baseImage, avatarCoords, setAvatarCoords]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        const jaVoice = availableVoices.find(v => v.lang.includes('ja'));
        if (jaVoice) setSelectedVoice(jaVoice.name);
        else setSelectedVoice(availableVoices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  const [isCheckingVoiceVox, setIsCheckingVoiceVox] = useState(false);

  const checkVoiceVox = async () => {
    setIsCheckingVoiceVox(true);
    try {
      const res = await fetch('http://127.0.0.1:50021/speakers', { method: 'GET', mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setVoiceVoxSpeakers(data);
        setIsVoiceVoxAvailable(true);
        setUseVoiceVox(true);
        if (data.length > 0 && data[0].styles.length > 0) {
          const zundamon = data.find((s: any) => s.name === 'ずんだもん');
          if (zundamon) {
             setSelectedVoiceVoxStyleId(zundamon.styles[0].id);
          } else {
             setSelectedVoiceVoxStyleId(data[0].styles[0].id);
          }
        }
      } else {
        setIsVoiceVoxAvailable(false);
      }
    } catch (e) {
      setIsVoiceVoxAvailable(false);
    } finally {
      setIsCheckingVoiceVox(false);
    }
  };

  useEffect(() => {
    checkVoiceVox();
  }, []);

  const handleSpeak = async () => {
    if (!ttsText.trim()) return;
    
    ttsVowelsRef.current = getVowelsFromText(ttsText);
    ttsStartTimeRef.current = performance.now();

    if (useVoiceVox && isVoiceVoxAvailable && selectedVoiceVoxStyleId !== null) {
       setIsSpeaking(true);
       try {
         if (audioRef.current) {
           audioRef.current.pause();
           audioRef.current.src = '';
         }

         const queryRes = await fetch(`http://127.0.0.1:50021/audio_query?text=${encodeURIComponent(ttsText)}&speaker=${selectedVoiceVoxStyleId}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' }
         });
         if (!queryRes.ok) throw new Error('Query failed');
         const queryData = await queryRes.json();

         const synthRes = await fetch(`http://127.0.0.1:50021/synthesis?speaker=${selectedVoiceVoxStyleId}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Accept': 'audio/wav' },
           body: JSON.stringify(queryData)
         });
         if (!synthRes.ok) throw new Error('Synthesis failed');
         const audioBlob = await synthRes.blob();
         const audioUrl = URL.createObjectURL(audioBlob);

         const audio = new Audio(audioUrl);
         audioRef.current = audio;
         audio.onended = () => {
           setIsSpeaking(false);
           URL.revokeObjectURL(audioUrl);
         };
         audio.onerror = () => setIsSpeaking(false);
         audio.play();

       } catch (e) {
         console.error('VoiceVox Error', e);
         alert('VOICEVOXとの通信に失敗しました。VOICEVOXが起動しているか確認してください。');
         setIsSpeaking(false);
       }
    } else {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(ttsText);
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        ttsStartTimeRef.current = performance.now();
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCoordChange = (part: 'leftEye' | 'rightEye' | 'mouth', key: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (!avatarCoords) return;
    setAvatarCoords({
      ...avatarCoords,
      [part]: { ...avatarCoords[part], [key]: value }
    });
  };

  const handleColorChange = (part: 'leftEye' | 'rightEye' | 'mouth', color: string) => {
    if (setCustomSkinColors) {
       setCustomSkinColors({ ...(customSkinColors || { leftEye: null, rightEye: null, mouth: null }), [part]: color });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const intrinsicRatio = canvas.width / canvas.height;
    const clientRatio = rect.width / rect.height;

    let drawWidth, drawHeight, drawX, drawY;

    if (clientRatio > intrinsicRatio) {
      drawHeight = rect.height;
      drawWidth = canvas.width * (rect.height / canvas.height);
      drawX = (rect.width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = rect.width;
      drawHeight = canvas.height * (rect.width / canvas.width);
      drawX = 0;
      drawY = (rect.height - drawHeight) / 2;
    }

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX >= drawX && clickX <= drawX + drawWidth && clickY >= drawY && clickY <= drawY + drawHeight) {
        const px = (clickX - drawX) / drawWidth * canvas.width;
        const py = (clickY - drawY) / drawHeight * canvas.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
           try {
             const pixel = ctx.getImageData(px, py, 1, 1).data;
             const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1).padStart(6, '0');
             handleColorChange(isPickingColor, hex);
           } catch(e) {}
           setIsPickingColor(null);
        }
    }
  };

  // Convert screen clientX/Y → relative image coords (0-1)
  const clientToRelCoord = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const intrinsicRatio = canvas.width / canvas.height;
    const clientRatio = rect.width / rect.height;
    let drawWidth, drawHeight, drawX = 0, drawY = 0;
    if (clientRatio > intrinsicRatio) {
      drawHeight = rect.height;
      drawWidth = canvas.width * (rect.height / canvas.height);
      drawX = (rect.width - drawWidth) / 2;
    } else {
      drawWidth = rect.width;
      drawHeight = canvas.height * (rect.width / canvas.width);
      drawY = (rect.height - drawHeight) / 2;
    }
    const relX = (clientX - rect.left - drawX) / drawWidth;
    const relY = (clientY - rect.top - drawY) / drawHeight;
    return { x: relX, y: relY };
  };

  // Convert relative image coords → absolute screen position (for handle overlays)
  const relToScreen = (relX: number, relY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const intrinsicRatio = canvas.width / canvas.height;
    const clientRatio = rect.width / rect.height;
    let drawWidth, drawHeight, drawX = 0, drawY = 0;
    if (clientRatio > intrinsicRatio) {
      drawHeight = rect.height;
      drawWidth = canvas.width * (rect.height / canvas.height);
      drawX = (rect.width - drawWidth) / 2;
    } else {
      drawWidth = rect.width;
      drawHeight = canvas.height * (rect.width / canvas.width);
      drawY = (rect.height - drawHeight) / 2;
    }
    return {
      x: rect.left + drawX + relX * drawWidth,
      y: rect.top + drawY + relY * drawHeight,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPickingColor) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      updateLoupe(e.clientX, e.clientY);
      return;
    }
    
    if (showTools && avatarCoords && selectedPart) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      isDraggingRef.current = true;
      
      const part = avatarCoords[selectedPart];
      if (part) {
        setHandleDragStart({ px: e.clientX, py: e.clientY, ox: part.x, oy: part.y });
        setDragScreenPos({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    // Drag model if not editing coordinates
    if (!showTools || !selectedPart) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingModel(true);
      setModelDragStart({ px: e.clientX, py: e.clientY, ox: modelOffset.x, oy: modelOffset.y });
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPickingColor && loupePos !== null) {
      e.preventDefault();
      updateLoupe(e.clientX, e.clientY);
      return;
    }

    if (isDraggingModel) {
      e.preventDefault();
      const dx = e.clientX - modelDragStart.px;
      const dy = e.clientY - modelDragStart.py;
      setModelOffset({ x: modelDragStart.ox + dx, y: modelDragStart.oy + dy });
      return;
    }

    if (!isDragging || !selectedPart || !handleDragStart || !avatarCoords) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const iR = canvas.width / canvas.height, cR = rect.width / rect.height;
    const dW = cR > iR ? canvas.width * (rect.height / canvas.height) : rect.width;
    const dH = cR > iR ? rect.height : canvas.height * (rect.width / canvas.width);
    const dx = (e.clientX - handleDragStart.px) / dW;
    const dy = (e.clientY - handleDragStart.py) / dH;
    
    const part = avatarCoords[selectedPart];
    setAvatarCoords({
      ...avatarCoords,
      [selectedPart]: { 
        ...part, 
        x: Math.max(0, Math.min(1, handleDragStart.ox + dx)), 
        y: Math.max(0, Math.min(1, handleDragStart.oy + dy)) 
      }
    });
    setDragScreenPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    if (isPickingColor && loupePos !== null) {
      handleColorChange(isPickingColor, loupeSampleColor);
      setIsPickingColor(null);
      setShowTools(true);
      setLoupePos(null);
      return;
    }
    setIsDragging(false);
    isDraggingRef.current = false;
    setDragScreenPos(null);
    setHandleDragStart(null);
    setIsDraggingModel(false);
  };

  // Loupe: sample canvas pixel and update loupe canvas
  const updateLoupe = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const loupeCanvas = loupeCanvasRef.current;
    if (!canvas || !loupeCanvas) return;
    const coord = clientToRelCoord(clientX, clientY);
    if (!coord) return;
    const lctx = loupeCanvas.getContext('2d');
    if (!lctx) return;
    const LOUPE_SZ = 120, SAMPLE_SZ = 40;
    const sx = coord.x * canvas.width - SAMPLE_SZ / 2;
    const sy = coord.y * canvas.height - SAMPLE_SZ / 2;
    lctx.clearRect(0, 0, LOUPE_SZ, LOUPE_SZ);
    try { lctx.drawImage(canvas, sx, sy, SAMPLE_SZ, SAMPLE_SZ, 0, 0, LOUPE_SZ, LOUPE_SZ); } catch(e) {}
    try {
      const ctx2 = canvas.getContext('2d');
      const px = Math.floor(coord.x * canvas.width);
      const py = Math.floor(coord.y * canvas.height);
      const d = ctx2?.getImageData(px, py, 1, 1).data;
      if (d) setLoupeSampleColor('#' + ((1<<24)+(d[0]<<16)+(d[1]<<8)+d[2]).toString(16).slice(1).padStart(6,'0'));
    } catch(e) {}
    setLoupePos({ x: clientX, y: clientY });
  };



  useEffect(() => {
    if (!baseImage) {
      navigate('/settings');
      return;
    }

    let landmarker: FaceLandmarker;
    let animationFrameId: number;
    let videoElement = videoRef.current;
    let stream: MediaStream | null = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new Image();
    img.src = baseImage;
    const setupBaseCanvas = () => {
      if (!img.width || !img.height) return;
      const isGrid = !!originalGridImage;
      const targetW = isGrid ? img.width / 3 : img.width;
      const targetH = isGrid ? img.height / 3 : img.height;
      const fCanvas = document.createElement('canvas');
      fCanvas.width = targetW;
      fCanvas.height = targetH;
      const fCtx = fCanvas.getContext('2d');
      if (fCtx) {
        if (isGrid) {
          fCtx.drawImage(img, 0, 0, targetW, targetH, 0, 0, targetW, targetH);
        } else {
          fCtx.drawImage(img, 0, 0);
        }
      }
      baseFaceCanvasRef.current = fCanvas;
      drawBaseImageOnly();
    };

    img.onload = setupBaseCanvas;
    if (img.complete) {
      setupBaseCanvas();
    }

    let smoothedAngle = 0;
    let smoothedX = 0;
    let smoothedY = 0;
    let hasSampledColors = false;
    
    let currentTargetAngle = 0;
    let currentTargetX = 0;
    let currentTargetY = 0;

    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseTargetAngle = 0;

    const handlePointerMoveTrack = (e: PointerEvent) => {
      const winW = window.innerWidth || 1000;
      const winH = window.innerHeight || 800;
      const normX = (e.clientX / winW) - 0.5;
      const normY = (e.clientY / winH) - 0.5;
      mouseTargetX = -normX * 80;
      mouseTargetY = normY * 60;
      mouseTargetAngle = normX * 0.12;
    };
    window.addEventListener('pointermove', handlePointerMoveTrack);

    function drawBaseImageOnly() {
      if (!canvas || !ctx) return;
      const isGrid = !!originalGridImage;
      const targetW = isGrid ? (img.naturalWidth || img.width) / 3 : (img.naturalWidth || img.width || 800);
      const targetH = isGrid ? (img.naturalHeight || img.height) / 3 : (img.naturalHeight || img.height || 800);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const layers = psdLayersRef.current;
      if (layers && layers.length > 0) {
        layers.forEach(layer => {
          if (layer.visible && layer.canvas) {
            if (layer.blendMode) {
                let op = 'source-over';
                switch (layer.blendMode) {
                    case 'multiply': op = 'multiply'; break;
                    case 'screen': op = 'screen'; break;
                    case 'linear dodge': op = 'lighter'; break;
                    case 'color dodge': op = 'color-dodge'; break;
                    case 'overlay': op = 'overlay'; break;
                    case 'darken': op = 'darken'; break;
                    case 'lighten': op = 'lighten'; break;
                    case 'color burn': op = 'color-burn'; break;
                    case 'hard light': op = 'hard-light'; break;
                    case 'soft light': op = 'soft-light'; break;
                    case 'difference': op = 'difference'; break;
                    case 'exclusion': op = 'exclusion'; break;
                    case 'subtract': op = 'difference'; break;
                }
                ctx.globalCompositeOperation = op as GlobalCompositeOperation;
            }
            if (layer.opacity !== undefined) {
                ctx.globalAlpha = layer.opacity;
            }
            ctx.drawImage(layer.canvas, layer.left, layer.top);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
          }
        });
      } else {
        ctx.drawImage(baseFaceCanvasRef.current || img, 0, 0, canvas.width, canvas.height);
      }
    };



    async function startCamera() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          });
          if (videoElement) {
            videoElement.srcObject = stream;
            await videoElement.play().catch(() => {});
          }
        } catch (camErr) {
          console.warn('Ideal camera constraints failed, trying basic video constraint:', camErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoElement) {
              videoElement.srcObject = stream;
              await videoElement.play().catch(() => {});
            }
          } catch (camErr2) {
            console.warn('Camera permission denied or unavailable:', camErr2);
          }
        }
      }
    };

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // --- GRID 表情シートの自動解析・切り出し ---
        if (originalGridImage) {
          const gridImg = new Image();
          gridImg.src = originalGridImage;
          await new Promise(r => { gridImg.onload = r; });

          const tempLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'IMAGE',
            numFaces: 4
          });
          
          try {
            const results = tempLandmarker.detect(gridImg);
            if (results && results.faceLandmarks && results.faceLandmarks.length >= 1) {
              console.log(`Grid expression sheet detected from context (base face found)!`);
              const parsed = parseGridSheet(gridImg, results.faceLandmarks);
              if (parsed) {
                gridExpressionCanvasesRef.current = parsed;
              }
            }
          } catch (err) {
            console.error("Grid image landmarker failed:", err);
          } finally {
            tempLandmarker.close();
          }
        }

        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });
      } catch (err) {
        console.error('Error starting mediapipe', err);
      }
    };

    // Trigger camera request and MediaPipe init concurrently
    startCamera();
    initMediaPipe();

    let lastVideoTime = -1;
    let lastTimestamp = 0;
    let currentResults: any = null;

    function renderLoop() {
      if (landmarker && videoElement && videoElement.readyState >= 2) {
        if (videoElement.currentTime !== lastVideoTime) {
          lastVideoTime = videoElement.currentTime;
          const now = performance.now();
          if (now > lastTimestamp) {
            lastTimestamp = now;
            try {
              const res = landmarker.detectForVideo(videoElement, now);
              if (res) {
                currentResults = res;
              }
            } catch (e) {
              console.error("Error in detectForVideo:", e);
            }
          }
        }
      }
      drawAvatar(currentResults);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // Start continuous render loop immediately so avatar composites right away
    renderLoop();

    function drawAvatar(results: any) {
      if (!canvas || !ctx) return;
      if (!img || !img.complete || img.width === 0 || img.height === 0) return;
      
      const isGrid = !!originalGridImage;
      const targetW = isGrid ? img.width / 3 : img.width;
      const targetH = isGrid ? img.height / 3 : img.height;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
        setIsTracking(true);
        const landmarks = results.faceLandmarks[0];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const nose = landmarks[1];
        
        currentTargetAngle = Math.atan2(leftEye.y - rightEye.y, Math.abs(leftEye.x - rightEye.x));
        currentTargetX = (0.5 - nose.x) * cw * 0.45;
        currentTargetY = (nose.y - 0.5) * ch * 0.45;
      } else {
        const now = performance.now();
        const breathY = Math.sin(now / 700) * 6;
        const breathAngle = Math.sin(now / 1200) * 0.02;
        currentTargetAngle = mouseTargetAngle + breathAngle;
        currentTargetX = mouseTargetX;
        currentTargetY = mouseTargetY + breathY;
        setIsTracking(false);
      }

      if (!showToolsRef.current) {
        smoothedAngle += (currentTargetAngle * 1.2 - smoothedAngle) * 0.15;
        smoothedX += (currentTargetX - smoothedX) * 0.15;
        smoothedY += (currentTargetY - smoothedY) * 0.15;
      } else {
        // Smoothly return to neutral position when editing
        smoothedAngle += (0 - smoothedAngle) * 0.1;
        smoothedX += (0 - smoothedX) * 0.1;
        smoothedY += (0 - smoothedY) * 0.1;
      }

      const coords = avatarCoordsRef.current;
      const sens = sensitivityRef.current;
      const customColors = customSkinColorsRef.current;
      let isEyeClosed = false;
      let isMouthOpen = false;
      let animatedJawOpen = 0;
      let jawOpen = 0;
      let currentVowel: 'a' | 'i' | 'u' | 'e' | 'o' | null = null;

      if (results?.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
        const eyeBlinkLeft = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkLeft')?.score || 0;
        const eyeBlinkRight = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkRight')?.score || 0;
        jawOpen = blendshapes.find((b: any) => b.categoryName === 'jawOpen')?.score || 0;
        const mouthSmile = Math.max(blendshapes.find((b: any) => b.categoryName === 'mouthSmileLeft')?.score || 0, blendshapes.find((b: any) => b.categoryName === 'mouthSmileRight')?.score || 0);
        const mouthPucker = blendshapes.find((b: any) => b.categoryName === 'mouthPucker')?.score || 0;
        const mouthFunnel = blendshapes.find((b: any) => b.categoryName === 'mouthFunnel')?.score || 0;
        const mouthStretch = Math.max(blendshapes.find((b: any) => b.categoryName === 'mouthStretchLeft')?.score || 0, blendshapes.find((b: any) => b.categoryName === 'mouthStretchRight')?.score || 0);
        
        let lipDistance = 0;
        if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
           const lm = results.faceLandmarks[0];
           lipDistance = Math.abs(lm[14].y - lm[13].y);
        }

        const eyeCloseThreshold = Math.min(sens.eyeClose || 0.3, 0.28);
        const mouthOpenThreshold = Math.min(sens.mouthOpen || 0.1, 0.08);

        isEyeClosed = eyeBlinkLeft > eyeCloseThreshold || eyeBlinkRight > eyeCloseThreshold;
        isMouthOpen = jawOpen > mouthOpenThreshold;
        animatedJawOpen = jawOpen;

        if (isMouthOpen || mouthPucker > 0.1 || mouthFunnel > 0.1 || (lipDistance > 0.005 && (mouthSmile > 0.1 || mouthStretch > 0.1))) {
           isMouthOpen = true; 
           if (mouthSmile > 0.1 || mouthStretch > 0.1) {
              currentVowel = jawOpen > 0.10 ? 'e' : 'i';
              animatedJawOpen = Math.max(jawOpen, 0.15);
           }
           else if (mouthPucker > 0.1) {
              currentVowel = 'u';
              animatedJawOpen = Math.max(jawOpen, 0.15);
           }
           else if (mouthFunnel > 0.1) {
              currentVowel = 'o';
              animatedJawOpen = Math.max(jawOpen, 0.15);
           }
           else if (jawOpen > sens.mouthOpen) {
              currentVowel = 'a';
           }
        }
      }

      if (mouthControlSourceRef.current === 'audio') {
        const audioVol = volumeRef.current;
        const sensitivityVal = sens.mouthOpen !== undefined ? sens.mouthOpen : 0.10;
        const multiplier = audioMultiplierRef.current;
        const mappedJawOpen = Math.min(audioVol * multiplier, 1.0);
        
        isMouthOpen = mappedJawOpen > sensitivityVal;
        animatedJawOpen = mappedJawOpen;
        
        if (isMouthOpen) {
          if (mappedJawOpen > 0.6) {
            currentVowel = 'a';
          } else if (mappedJawOpen > 0.3) {
            currentVowel = 'o';
          } else {
            currentVowel = 'u';
          }
        } else {
          currentVowel = null;
        }
      }

      if (isSpeakingRef.current) {
         const time = performance.now();
         const elapsed = time - ttsStartTimeRef.current;
         const vowels = ttsVowelsRef.current;
         const vowelIndex = Math.floor(elapsed / 150);
         if (vowels && vowels.length > 0) {
           currentVowel = vowels[Math.min(vowelIndex, vowels.length - 1)];
           isMouthOpen = currentVowel !== null;
           animatedJawOpen = currentVowel ? (Math.sin(elapsed / 30) * 0.15 + 0.35) : 0;
         } else {
           const lipSyncValue = (Math.sin(time / 50) * 0.5 + 0.5) * 0.4;
           animatedJawOpen = Math.max(animatedJawOpen, lipSyncValue);
           isMouthOpen = animatedJawOpen > 0.1;
         }
      }

      setIsTracking(true);

      if (coords && !hasSampledColors && img.width > 0) {
         const tempCanvas = document.createElement('canvas');
         tempCanvas.width = img.width;
         tempCanvas.height = img.height;
         const tempCtx = tempCanvas.getContext('2d');
         if (tempCtx) {
           tempCtx.drawImage(img, 0, 0, img.width, img.height);
           const { leftEye, rightEye, mouth } = coords;
           
           const getHexFromPixel = (x: number, y: number) => {
             try {
                const p = tempCtx.getImageData(x, y, 1, 1).data;
                if (p[3] === 0) return '#ffcccc';
                return "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).padStart(6, '0');
             } catch (e) { return '#ffcccc'; }
           };
           const getSkin = (part: any) => part ? getHexFromPixel(part.x * img.width + part.width * img.width / 2, part.y * img.height) : '#ffcccc';
           const newSampled = { leftEye: getSkin(leftEye), rightEye: getSkin(rightEye), mouth: getSkin(mouth) };
           sampledColorsRef.current = newSampled;
           setSampledColors(newSampled);
           hasSampledColors = true;
         }
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      
      // Zoom and offset model based on user interactions
      ctx.translate(cw / 2 + modelOffsetRef.current.x, ch / 2 + modelOffsetRef.current.y);
      ctx.scale(modelScaleRef.current, modelScaleRef.current);
      ctx.translate(-cw / 2, -ch / 2 + ch * 0.18);
      
      const layers = psdLayersRef.current;
      let pivotY = ch * 0.65;
      let pivotX = cw * 0.5;
      if (coords) {
          if (coords.neckY !== undefined) {
              pivotY = (coords.neckY / 100) * ch;
          }
          if (coords.neckX !== undefined) {
              pivotX = (coords.neckX / 100) * cw;
          }
      }
      
      if (layers && layers.length > 0) {
          layers.forEach(layer => {
              if (!layer.visible || !layer.canvas) return;
              
              const name = layer.name.toLowerCase();
              const isHair = name.includes('髪') || name.includes('hair');
              const isHead = name.includes('頭') || name.includes('顔') || name.includes('head') || name.includes('face') || name.includes('目') || name.includes('口') || name.includes('eye') || name.includes('mouth');
              const isEyeOpenLayer = name.includes('目開') || name.includes('eye_open');
              const isEyeClosedLayer = name.includes('目閉') || name.includes('eye_close');
              const isMouthOpenLayer = name.includes('口開') || name.includes('mouth_open');
              const isMouthClosedLayer = name.includes('口閉') || name.includes('mouth_close');
              
              if (isEyeOpenLayer && isEyeClosed) return;
              if (isEyeClosedLayer && !isEyeClosed) return;
              if (isMouthOpenLayer && !isMouthOpen) return;
              if (isMouthClosedLayer && isMouthOpen) return;
              
              ctx.save();
              if (isHair) {
                  const swayX = smoothedX * 1.5;
                  const swayY = smoothedY * 1.2;
                  const swayAngle = smoothedAngle * 1.2;
                  ctx.translate(pivotX + swayX, pivotY + swayY);
                  ctx.rotate(swayAngle);
                  ctx.translate(-pivotX, -pivotY);
              } else if (isHead) {
                  ctx.translate(pivotX + smoothedX, pivotY + smoothedY);
                  ctx.rotate(smoothedAngle);
                  ctx.translate(-pivotX, -pivotY);
              } else {
                  // Body sway
                  ctx.translate(pivotX + smoothedX * 0.1, pivotY + smoothedY * 0.1);
                  ctx.rotate(smoothedAngle * 0.1);
                  ctx.translate(-pivotX, -pivotY);
              }
              if (layer.blendMode) {
                  let op = 'source-over';
                  switch (layer.blendMode) {
                      case 'multiply': op = 'multiply'; break;
                      case 'screen': op = 'screen'; break;
                      case 'linear dodge': op = 'lighter'; break;
                      case 'color dodge': op = 'color-dodge'; break;
                      case 'overlay': op = 'overlay'; break;
                      case 'darken': op = 'darken'; break;
                      case 'lighten': op = 'lighten'; break;
                      case 'color burn': op = 'color-burn'; break;
                      case 'hard light': op = 'hard-light'; break;
                      case 'soft light': op = 'soft-light'; break;
                      case 'difference': op = 'difference'; break;
                      case 'exclusion': op = 'exclusion'; break;
                      case 'subtract': op = 'difference'; break; // CanvasAPIにはsubtractがないため近いものを指定
                  }
                  ctx.globalCompositeOperation = op as GlobalCompositeOperation;
              }

              if (layer.opacity !== undefined) {
                  ctx.globalAlpha = layer.opacity;
              }

              ctx.drawImage(layer.canvas, layer.left, layer.top);
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1.0;
              ctx.restore();
          });
          
          ctx.save();
          ctx.translate(pivotX + smoothedX, pivotY + smoothedY);
          ctx.rotate(smoothedAngle);
          ctx.translate(-pivotX, -pivotY);
      } else {
          ctx.save();
          ctx.translate(pivotX + smoothedX, pivotY + smoothedY);
          ctx.rotate(smoothedAngle);
          ctx.translate(-pivotX, -pivotY);
          ctx.drawImage(baseFaceCanvasRef.current || img, 0, 0, canvas.width, canvas.height);
      }

        if (isSpeakingRef.current) {
           const time = performance.now();
           const elapsed = time - ttsStartTimeRef.current;
           const vowels = ttsVowelsRef.current;
           const vowelIndex = Math.floor(elapsed / 150);
           if (vowels && vowels.length > 0) {
             currentVowel = vowels[Math.min(vowelIndex, vowels.length - 1)];
             isMouthOpen = currentVowel !== null;
             animatedJawOpen = currentVowel ? (Math.sin(elapsed / 30) * 0.15 + 0.35) : 0;
           } else {
             const lipSyncValue = (Math.sin(time / 50) * 0.5 + 0.5) * 0.4;
             animatedJawOpen = Math.max(jawOpen, lipSyncValue);
             isMouthOpen = animatedJawOpen > 0.1;
           }
        }

        setIsTracking(true);

        if (coords) {
          const { leftEye, rightEye, mouth } = coords;
          const eyesBox = (coords as any).eyesBox || null;
          const maxMoveX = cw * 0.04;
          const maxMoveY = ch * 0.04;
          const pX = 0;
          const pY = 0;

          console.log("MainScreen DRAW:", { eyesBox, mouth, cw, ch });
          // === UNIFIED EYES BOX (both-eyes-as-one sprite) ===
          if (eyesBox) {
            const sc = partScalesRef.current.leftEye || 1;
            const x = eyesBox.x * cw;
            const y = eyesBox.y * ch;
            const w = eyesBox.width * cw * sc;

            const assetEyes = isEyeClosed
              ? assetSheetImagesRef.current.eyesClosed
              : assetSheetImagesRef.current.eyesOpen;

            if (assetEyes) {
              const aspect = (assetEyes.complete && assetEyes.naturalWidth > 0)
                ? (assetEyes.naturalWidth / assetEyes.naturalHeight)
                : 1.0;
              const h = w / aspect;
              const ox = x + (eyesBox.width * cw - w) / 2;
              const oy = y + (eyesBox.height * ch - h) / 2;

              ctx.save();
              ctx.translate(ox + w/2 + pX, oy + h/2 + pY);
              ctx.drawImage(assetEyes, -w/2, -h/2, w, h);
              ctx.restore();
            }
          }

          const drawEye = (eye: any, isClosed: boolean, isLeft: boolean) => {
            if (!eye) return;
            // Skip if we're using unified eyesBox
            if (eyesBox) return;
            const sc = isLeft ? partScalesRef.current.leftEye : partScalesRef.current.rightEye;
            const x = eye.x * cw;
            const y = eye.y * ch;
            const w = eye.width * cw * sc;
            
            const assetEye = isLeft
              ? (isClosed ? assetSheetImagesRef.current.leftEyeClosed : assetSheetImagesRef.current.leftEyeOpen)
              : (isClosed ? assetSheetImagesRef.current.rightEyeClosed : assetSheetImagesRef.current.rightEyeOpen);

            const aspect = (assetEye && assetEye.complete && assetEye.naturalWidth > 0)
              ? (assetEye.naturalWidth / assetEye.naturalHeight)
              : (eye.width * cw) / (eye.height * ch || 1);
            const h = w / aspect;
            const ox = x + (eye.width * cw - w) / 2;
            const oy = y + (eye.height * ch - h) / 2;
            
            const thisDragged = isDraggingRef.current && selectedPartRef.current === (isLeft ? 'leftEye' : 'rightEye');
            ctx.save();
            if (thisDragged) ctx.globalAlpha = 0.35;
            ctx.translate(ox + w/2 + pX, oy + h/2 + pY);

            if (assetEye) {
              ctx.drawImage(assetEye, -w/2, -h/2, w, h);
            } else if (selectedEyeImgRef.current) {
                // カスタムSVGパーツを使う場合は肌色下地を先に描く
                const skin = customColors?.[isLeft ? 'leftEye' : 'rightEye'] || sampledColorsRef.current[isLeft ? 'leftEye' : 'rightEye'];
                ctx.save();
                ctx.filter = `blur(${Math.max(6, h * 0.25)}px)`;
                ctx.fillStyle = skin;
                ctx.beginPath();
                ctx.ellipse(0, 0, w/2 + 5, h/2 + 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                if (!isLeft) ctx.scale(-1, 1);
                if (isClosed) {
                    ctx.scale(1, 0.15);
                }
                ctx.drawImage(selectedEyeImgRef.current, -w/2, -h/2, w, h);
            } else {
                // 元の画像を切り抜いて使う場合
                if (isClosed) {
                    // 閉じた時：肌色で元の目を隠してからU字ラインを描く
                    const skin = customColors?.[isLeft ? 'leftEye' : 'rightEye'] || sampledColorsRef.current[isLeft ? 'leftEye' : 'rightEye'];
                    ctx.save();
                    ctx.filter = `blur(${Math.max(4, h * 0.2)}px)`;
                    ctx.fillStyle = skin;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, w/2 + 2, h/2 + 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    const lashColor = coords?.lashColorHex || '#222222';
                    ctx.strokeStyle = lashColor;
                    ctx.lineWidth = Math.max(1, h * 0.02);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(-w/2, -h * 0.05);
                    ctx.quadraticCurveTo(0, h * 0.25, w/2, -h * 0.05);
                    ctx.stroke();
                } else {
                    // 開いている時：元の画像をそのまま描く（下地不要）
                    ctx.drawImage(baseFaceCanvasRef.current || img, eye.x * cw, eye.y * ch, eye.width * cw, eye.height * ch, -w/2, -h/2, w, h);
                }
            }
            ctx.restore();
          };

          drawEye(leftEye, isEyeClosed, true);
          drawEye(rightEye, isEyeClosed, false);

          if (mouth) {
             const msc = partScalesRef.current.mouth;
             const mx = mouth.x * cw;
             const my = mouth.y * ch;
             const mw = mouth.width * cw * msc;
             
             const assetMouth = (isMouthOpen && animatedJawOpen > (sensitivityRef.current?.mouthOpen || 0.1))
               ? (assetSheetImagesRef.current.mouthOpen || assetSheetImagesRef.current.mouthClosed)
               : assetSheetImagesRef.current.mouthClosed;

             const mAspect = (assetMouth && assetMouth.complete && assetMouth.naturalWidth > 0)
               ? (assetMouth.naturalWidth / assetMouth.naturalHeight)
               : (mouth.width * cw) / (mouth.height * ch || 1);
             const mh = mw / mAspect;
             const mox = mx + (mouth.width * cw - mw) / 2;
             const moy = my + (mouth.height * ch - mh) / 2;

              const mouthDragged = isDraggingRef.current && selectedPartRef.current === 'mouth';
              ctx.save();
              if (mouthDragged) ctx.globalAlpha = 0.35;
              ctx.translate(mox + mw/2 + pX, moy + mh/2 + pY);

               if (assetMouth) {
                   ctx.drawImage(assetMouth, -mw/2, -mh/2, mw, mh);
               } else if (selectedMouthImgRef.current) {
                    // カスタムSVGパーツ：閉じた状態から口を開く
                    let stretchX = 1.0;
                    let stretchY = 0.05; // 閉じ口のときの高さ比率
                    let useClosedMouth = true;

                    // 口の開き具合のしきい値
                    const mouthOpenThreshold = sensitivityRef.current?.mouthOpen || 0.1;
                    if (isMouthOpen && animatedJawOpen > mouthOpenThreshold) {
                        useClosedMouth = false;
                        if (currentVowel === 'a') {
                            stretchX = 1.0; stretchY = Math.max(0.15, animatedJawOpen * 3.0);
                        } else if (currentVowel === 'i') {
                            stretchX = 1.3; stretchY = Math.max(0.15, animatedJawOpen * 1.5);
                        } else if (currentVowel === 'u') {
                            stretchX = 0.6; stretchY = Math.max(0.15, animatedJawOpen * 2.5);
                        } else if (currentVowel === 'e') {
                            stretchX = 1.1; stretchY = Math.max(0.15, animatedJawOpen * 2.0);
                        } else if (currentVowel === 'o') {
                            stretchX = 0.8; stretchY = Math.max(0.15, animatedJawOpen * 3.5);
                        } else {
                            stretchY = Math.max(0.15, animatedJawOpen * 3.0);
                        }
                    }

                    ctx.scale(stretchX, stretchY);
                    
                    const mouthImg = (useClosedMouth && selectedMouthClosedImgRef.current) 
                        ? selectedMouthClosedImgRef.current 
                        : selectedMouthImgRef.current;
                    
                    ctx.drawImage(mouthImg, -mw/2, -mh/2, mw, mh);
                } else {
                    // 元の画像切り抜き：常に元の口を表示し、開いた時だけ上に上書き描画する
                    // まず元の口を描画
                    ctx.drawImage(img, mouth.x * cw, mouth.y * ch, mouth.width * cw, mouth.height * ch, -mw/2, -mh/2, mw, mh);
 
                    const openAmount = isMouthOpen ? Math.max(0.15, animatedJawOpen * 2.5) : 0;
                    if (openAmount > 0.15) {
                        const mouthH = (mh / 2) * openAmount;
                        
                        // 口の中（暗い色）を描画
                        ctx.fillStyle = '#441111';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, mw * 0.38, mouthH, 0, 0, Math.PI * 2);
                        ctx.fill();
 
                        // 舌（ピンク）を口の底に描画
                        ctx.save();
                        ctx.beginPath();
                        ctx.ellipse(0, 0, mw * 0.38, mouthH, 0, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.fillStyle = '#c96060';
                        ctx.beginPath();
                        ctx.ellipse(0, mouthH * 0.3, mw * 0.28, mouthH * 0.7, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
                ctx.restore();
            }
        }
        ctx.restore(); // Matches the head translation ctx.save()
        ctx.restore(); // Matches the zoom ctx.save() at the start of drawAvatar
    };

    initMediaPipe();
    return () => {
      window.removeEventListener('pointermove', handlePointerMoveTrack);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (landmarker) landmarker.close();
    };
  }, [baseImage, navigate]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', backgroundColor: bgColor, display: 'flex', justifyContent: 'center', alignItems: 'center', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <video ref={videoRef} autoPlay playsInline muted className="hidden-video" />
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={(e) => {
          const delta = e.deltaY < 0 ? 0.05 : -0.05;
          setModelScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
        }}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: isPickingColor ? 'crosshair' : (selectedPart && showTools ? 'grab' : 'default'), touchAction: 'none' }}
      />
      {isPickingColor && <div style={{ position: 'absolute', top: '4rem', background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '1rem' }}>画像から色を抽出したい場所をタップしてください</div>}
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 40 }}>
        <div style={{ display: 'flex', gap: '0.4rem', pointerEvents: 'auto', flexWrap: 'wrap' }}>
          <button 
            onClick={() => {
              navigate('/settings');
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', border: 'none', borderRadius: '20px', color: 'white', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)' }}
            title="配置調整・貼り付け画面に戻る"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>配置調整に戻る</span>
          </button>

          <button 
            onClick={() => {
              setBaseImage(null);
              setPsdLayers(null);
              setAvatarCoords(null);
              setParsedAssetSheetParts(null);
              setCustomSkinColors({ leftEye: null, rightEye: null, mouth: null });
              navigate('/settings');
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', color: '#e2e8f0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
            title="別画像をアップロード"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)'}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>画像変更</span>
          </button>

          <button 
            onClick={handleSaveToBrowser} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '20px', color: 'white', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)' }}
            title="キャラクター設定をブラウザの保存リストに保存"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Save size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>ブラウザ保存</span>
          </button>

          <button 
            onClick={handleExportCharacter} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', color: '#e2e8f0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
            title="キャラクター設定をJSONファイルで保存（PCへダウンロード）"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)'}
          >
            <Download size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>ファイル書き出し (.json)</span>
          </button>
        </div>

        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.375rem 0.375rem 0.375rem 1rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'white', fontWeight: 500, letterSpacing: '0.025em' }}>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isTracking ? '#4ade80' : '#f87171', boxShadow: `0 0 8px ${isTracking ? '#4ade80' : '#f87171'}` }} />
             {isTracking ? 'TRACKING' : 'STANDBY'}
          </div>
          <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
          <button 
            onClick={() => {
              setShowTools(!showTools);
            }} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: showTools ? 'rgba(59, 130, 246, 0.6)' : 'transparent', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
            title="微調整"
            onMouseEnter={(e) => { if(!showTools) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={(e) => { if(!showTools) e.currentTarget.style.background = 'transparent' }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>





      {/* ⚙️ 全体設定パネル (パーツ未選択時) */}
      {showTools && !selectedPart && !isDragging && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: '5.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 2rem)',
            maxWidth: '360px',
            backgroundColor: 'rgba(15,23,42,0.97)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '0.75rem',
            borderRadius: '1rem',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.5)',
            zIndex: 55,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>⚙️ 感度・位置設定</span>
            <button onClick={() => setShowTools(false)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>

          {/* 👄 口パクの制御方式 */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', fontWeight: 'bold' }}>👄 口パクの制御方式</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setMouthControlSource('camera')} 
                style={{ 
                  flex: 1, 
                  fontSize: '0.7rem', 
                  padding: '0.35rem 0.5rem', 
                  borderRadius: '6px', 
                  border: 'none', 
                  cursor: 'pointer',
                  background: mouthControlSource === 'camera' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: mouthControlSource === 'camera' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                📸 カメラ認識
              </button>
              <button 
                onClick={() => setMouthControlSource('audio')} 
                style={{ 
                  flex: 1, 
                  fontSize: '0.7rem', 
                  padding: '0.35rem 0.5rem', 
                  borderRadius: '6px', 
                  border: 'none', 
                  cursor: 'pointer',
                  background: mouthControlSource === 'audio' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: mouthControlSource === 'audio' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                🎙️ マイク音量
              </button>
            </div>
          </div>

          {/* 🎚️ トラッキング感度設定 */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.2rem' }}>
              <label>👄 {mouthControlSource === 'audio' ? 'マイクの口パク感度（高ほど開きやすい）' : '口開閉の感度'}: {sensitivity?.mouthOpen !== undefined ? sensitivity.mouthOpen.toFixed(2) : '0.10'}</label>
              <span style={{ color: '#10b981' }}>{sensitivity?.mouthOpen >= 0.2 ? '低感度（開きにくい）' : '高感度（開きやすい）'}</span>
            </div>
            <input 
              type="range" 
              min="0.02" 
              max="0.4" 
              step="0.01" 
              value={sensitivity?.mouthOpen !== undefined ? sensitivity.mouthOpen : 0.10} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSensitivity({ ...(sensitivity || { eyeClose: 0.4, mouthOpen: 0.1 }), mouthOpen: val });
              }} 
              style={{ width: '100%' }} 
            />
            {mouthControlSource === 'audio' ? (
              <div style={{ marginTop: '0.4rem', borderTop: '1px dotted rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.2rem' }}>
                  <label>🎙️ マイク入力の倍率: {audioMultiplier.toFixed(1)}倍</label>
                  <span style={{ color: '#10b981' }}>{audioMultiplier >= 8.0 ? '大声向け' : audioMultiplier <= 3.0 ? '小声向け' : '標準'}</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="15.0" 
                  step="0.5" 
                  value={audioMultiplier} 
                  onChange={(e) => setAudioMultiplier(parseFloat(e.target.value))} 
                  style={{ width: '100%' }} 
                />
              </div>
            ) : (
              <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                ※口が意図せずパタパタ動いてしまう現象を抑えたい場合は、感度値を上げてみてください。
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.2rem' }}>
              <label>👁 まばたき感度: {sensitivity?.eyeClose !== undefined ? sensitivity.eyeClose.toFixed(2) : '0.40'}</label>
              <span style={{ color: '#10b981' }}>{sensitivity?.eyeClose >= 0.5 ? '閉じにくい' : '閉じやすい'}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="0.9" 
              step="0.05" 
              value={sensitivity?.eyeClose !== undefined ? sensitivity.eyeClose : 0.40} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSensitivity({ ...(sensitivity || { eyeClose: 0.4, mouthOpen: 0.1 }), eyeClose: val });
              }} 
              style={{ width: '100%' }} 
            />
          </div>

          {/* 📍 キャラ位置調整・リセット */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>モデル位置</span>
            <button
              onClick={() => {
                setModelOffset({ x: 0, y: 0 });
                setModelScale(1.30);
              }}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              🔄 位置と拡大をリセット
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>背景色</span>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              {([
                { value: 'transparent', label: 'T', desc: '透過背景' },
                { value: '#00ff00', label: '', desc: 'グリーンバック' },
                { value: '#ffffff', label: '', desc: '白' },
                { value: '#000000', label: '', desc: '黒' }
              ] as const).map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setBgColor(item.value)}
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    border: bgColor === item.value ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                    background: item.value === 'transparent'
                      ? 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px'
                      : item.value,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    outline: 'none'
                  }}
                  title={item.desc}
                >
                  {item.label && <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 'bold' }}>{item.label}</span>}
                </button>
              ))}
              <input
                type="color"
                value={bgColor.startsWith('#') ? bgColor : '#00ff00'}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', cursor: 'pointer', padding: 0, border: '1px solid rgba(255,255,255,0.2)', background: 'none' }}
                title="カスタムカラー"
              />
            </div>
          </div>
        </div>
      )}

      {/* ドラッグ中の小窓プレビュー */}
      {isDragging && dragScreenPos && selectedPart && (
        <div style={{
          position: 'fixed',
          left: dragScreenPos.x + 24,
          top: dragScreenPos.y - 110,
          background: 'rgba(15,23,42,0.95)',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '0.5rem 0.75rem',
          pointerEvents: 'none',
          zIndex: 100,
          minWidth: '120px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginBottom: '4px' }}>
            {selectedPart === 'leftEye' ? '👁 左目' : selectedPart === 'rightEye' ? '👁 右目' : '👄 口'}を移動中
          </div>
          <div style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
            X: {avatarCoords ? (avatarCoords[selectedPart]!.x * 100).toFixed(1) : 0}%　
            Y: {avatarCoords ? (avatarCoords[selectedPart]!.y * 100).toFixed(1) : 0}%
          </div>
          {(selectedPart !== 'mouth' ? selectedEyeImgRef.current : selectedMouthImgRef.current) && (
            <img
              src={(selectedPart !== 'mouth' ? selectedEyeImgRef.current! : selectedMouthImgRef.current!).src}
              style={{ display: 'block', width: '80px', height: '40px', objectFit: 'contain', marginTop: '6px', opacity: 0.9 }}
              alt="part preview"
            />
          )}
        </div>
      )}

      {/* 虫眼鏡ルーペUI */}
      {isPickingColor && loupePos && (
        <div style={{
          position: 'fixed',
          left: loupePos.x - 60,
          top: loupePos.y - 160,
          width: 120, height: 120,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid white',
          boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          zIndex: 200,
        }}>
          <canvas ref={loupeCanvasRef} width={120} height={120} style={{ display: 'block', width: '100%', height: '100%' }} />
          {/* Crosshair */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.8)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.8)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: loupeSampleColor, border: '2px solid white' }} />
          </div>
          {/* Color strip */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%', background: loupeSampleColor, borderTop: '1px solid rgba(255,255,255,0.4)' }} />
        </div>
      )}


      {/* 常時表示のコメント読み上げパネル */}
      <div style={{
        position: 'absolute',
        bottom: '0.75rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 1.5rem)',
        maxWidth: '760px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0.6rem 0.75rem',
        borderRadius: '0.85rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isVoiceVoxAvailable ? (
            <>
              <label style={{ fontSize: '0.7rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={useVoiceVox} onChange={(e) => setUseVoiceVox(e.target.checked)} />
                VOICEVOX (接続済)
              </label>
              {useVoiceVox ? (
                <select
                  value={selectedVoiceVoxStyleId || ''}
                  onChange={(e) => setSelectedVoiceVoxStyleId(parseInt(e.target.value))}
                  style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #475569', fontSize: '0.8rem', minWidth: 150 }}
                >
                  {voiceVoxSpeakers.map(speaker =>
                    speaker.styles.map(style => (
                      <option key={`${speaker.speaker_uuid}-${style.id}`} value={style.id}>
                        {speaker.name} ({style.name})
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <select
                  value={selectedVoice || ''}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #475569', fontSize: '0.8rem', minWidth: 150 }}
                >
                  {voices.filter(v => v.lang.includes('ja')).length > 0
                    ? voices.filter(v => v.lang.includes('ja')).map(v => <option key={v.name} value={v.name}>{v.name.replace(/Microsoft|Google/gi, '').trim() || v.name}</option>)
                    : voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)
                  }
                </select>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                VOICEVOX未接続
              </div>
              <button 
                onClick={checkVoiceVox}
                disabled={isCheckingVoiceVox}
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                {isCheckingVoiceVox ? '確認中...' : '再接続'}
              </button>
              <select
                value={selectedVoice || ''}
                onChange={(e) => setSelectedVoice(e.target.value)}
                style={{ flex: 1, padding: '0.4rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #475569', fontSize: '0.8rem', minWidth: 150 }}
              >
                {voices.filter(v => v.lang.includes('ja')).length > 0
                  ? voices.filter(v => v.lang.includes('ja')).map(v => <option key={v.name} value={v.name}>{v.name.replace(/Microsoft|Google/gi, '').trim() || v.name}</option>)
                  : voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)
                }
              </select>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="セリフを入力 (Enterで再生)"
            style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #475569', fontSize: '16px', minWidth: 0 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSpeak();
            }}
          />
          <button
            onClick={handleSpeak}
            disabled={isSpeaking || !ttsText.trim()}
            style={{ padding: '0.6rem 1rem', backgroundColor: isSpeaking ? '#94a3b8' : '#10b981', color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: isSpeaking ? 'default' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.95rem', flexShrink: 0 }}
          >
            {isSpeaking ? '再生中' : '喋る'}
          </button>
        </div>
      </div>
      {/* 個別パーツ変更候補モーダル */}
      {candidateSelector && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCandidateSelector(null)}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', width: '90%', maxWidth: '350px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'white', marginTop: 0, fontSize: '1rem', textAlign: 'center', marginBottom: '1.5rem' }}>別のパーツを選ぶ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* 元の画像（切り抜き）を使用するオプション */}
              <div onClick={() => {
                if (candidateSelector === 'mouth') {
                  setAvatarCoords({ ...avatarCoords!, selectedMouthId: undefined });
                } else {
                  setAvatarCoords({ ...avatarCoords!, selectedEyeId: undefined });
                }
                setCandidateSelector(null);
              }} style={{ background: '#334155', borderRadius: '0.5rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', border: '1px solid #10b981' }} 
                  onMouseEnter={e => e.currentTarget.style.border = '1px solid #3b82f6'}
                  onMouseLeave={e => e.currentTarget.style.border = '1px solid #10b981'}
               >
                 <div style={{ flex: '0 0 50px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.2rem' }}>
                   🖼️
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>元の画像を使用する</div>
                   <div style={{ color: '#cbd5e1', fontSize: '0.65rem', marginTop: '2px' }}>元のイラストのパーツをそのまま切り抜いて使います</div>
                 </div>
               </div>

              {candidates.map(c => (
                <div key={c.id} onClick={() => {
                  if (candidateSelector === 'mouth') {
                    setAvatarCoords({ ...avatarCoords!, selectedMouthId: c.id });
                  } else {
                    setAvatarCoords({ ...avatarCoords!, selectedEyeId: c.id });
                  }
                  setCandidateSelector(null);
                }} style={{ background: '#334155', borderRadius: '0.5rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', border: '1px solid transparent' }} 
                   onMouseEnter={e => e.currentTarget.style.border = '1px solid #3b82f6'}
                   onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
                >
                  <div style={{ flex: '0 0 50px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={`${import.meta.env.BASE_URL}parts/${c.file}`} alt={c.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginTop: '2px' }}>{c.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setCandidateSelector(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '0.5rem', cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainScreen;
