import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { ArrowLeft, Monitor, Settings2, X, Save } from 'lucide-react';

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
  const { baseImage, sensitivity, avatarCoords, setAvatarCoords, customSkinColors, setCustomSkinColors, saveProfile, currentProfileName } = useAppContext();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [bgColor, setBgColor] = useState('#00ff00');
  const [showTools, setShowTools] = useState(false);
  const showToolsRef = useRef(showTools);
  
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
    fetch('/parts/library.json').then(r => r.json()).then(setPartsLibrary).catch(() => {});
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

  // Load and tint SVG parts dynamically
  useEffect(() => {
    const loadSvg = async (filename: string, replacements: Record<string, string>) => {
      try {
        const res = await fetch(`/parts/${filename}.svg`);
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
    }
    if (avatarCoords?.selectedMouthId) {
        loadSvg(avatarCoords.selectedMouthId, {
          'currentColor': avatarCoords.lashColorHex || '#222222',
          'var(--mouth-bg, #661111)': '#6b1b1b',
          'var(--mouth-bg, #441111)': '#441111',
          'var(--tongue-color, #ff6666)': '#b54141',
        }).then(img => { if (img) selectedMouthImgRef.current = img; });
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
  useEffect(() => {
    avatarCoordsRef.current = avatarCoords;
    sensitivityRef.current = sensitivity;
    customSkinColorsRef.current = customSkinColors;
  }, [avatarCoords, sensitivity, customSkinColors]);

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
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPickingColor && loupePos !== null) {
      e.preventDefault();
      updateLoupe(e.clientX, e.clientY);
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

    let smoothedAngle = 0;
    let smoothedX = 0;
    let smoothedY = 0;
    let hasSampledColors = false;
    
    let currentTargetAngle = 0;
    let currentTargetX = 0;
    let currentTargetY = 0;

    const drawBaseImageOnly = () => {
      if (!canvas || !ctx) return;
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      try {
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        if (pixel[3] > 0) {
          const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
          setBgColor(hex);
        }
      } catch (e) {}
    };

    if (img.complete) drawBaseImageOnly();
    else img.onload = drawBaseImageOnly;

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.addEventListener('loadeddata', predictWebcam);
          }
        }
      } catch (err) {
        console.error('Error starting camera/mediapipe', err);
      }
    };

    const predictWebcam = async () => {
      if (!videoElement || !landmarker) return;
      let startTimeMs = performance.now();
      
      try {
        const results = landmarker.detectForVideo(videoElement, startTimeMs);
        drawAvatar(results);
      } catch (e) {
        console.error("Error in drawAvatar:", e);
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const drawAvatar = (results: any) => {
      if (!canvas || !ctx) return;
      
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const nose = landmarks[1];
        
        currentTargetAngle = Math.atan2(leftEye.y - rightEye.y, Math.abs(leftEye.x - rightEye.x));
        currentTargetX = (0.5 - nose.x) * cw * 0.05;
        currentTargetY = (nose.y - 0.5) * ch * 0.05;
      }

      if (!showToolsRef.current) {
        smoothedAngle += (currentTargetAngle * 0.4 - smoothedAngle) * 0.05;
        smoothedX += (currentTargetX - smoothedX) * 0.05;
        smoothedY += (currentTargetY - smoothedY) * 0.05;
      } else {
        // Smoothly return to neutral position when editing
        smoothedAngle += (0 - smoothedAngle) * 0.1;
        smoothedX += (0 - smoothedX) * 0.1;
        smoothedY += (0 - smoothedY) * 0.1;
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      const pivotY = ch * 0.65;
      ctx.translate(cw / 2 + smoothedX, pivotY + smoothedY);
      ctx.rotate(smoothedAngle);
      ctx.translate(-cw / 2, -pivotY);
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const coords = avatarCoordsRef.current;
      const sens = sensitivityRef.current;
      const customColors = customSkinColorsRef.current;

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

      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
        const eyeBlinkLeft = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkLeft')?.score || 0;
        const eyeBlinkRight = blendshapes.find((b: any) => b.categoryName === 'eyeBlinkRight')?.score || 0;
        const jawOpen = blendshapes.find((b: any) => b.categoryName === 'jawOpen')?.score || 0;
        
        const mouthSmile = Math.max(blendshapes.find((b: any) => b.categoryName === 'mouthSmileLeft')?.score || 0, blendshapes.find((b: any) => b.categoryName === 'mouthSmileRight')?.score || 0);
        const mouthPucker = blendshapes.find((b: any) => b.categoryName === 'mouthPucker')?.score || 0;
        const mouthFunnel = blendshapes.find((b: any) => b.categoryName === 'mouthFunnel')?.score || 0;
        const mouthStretch = Math.max(blendshapes.find((b: any) => b.categoryName === 'mouthStretchLeft')?.score || 0, blendshapes.find((b: any) => b.categoryName === 'mouthStretchRight')?.score || 0);
        
        let lipDistance = 0;
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
           const lm = results.faceLandmarks[0];
           lipDistance = Math.abs(lm[14].y - lm[13].y); // 上唇下端と下唇上端の距離
        }

        const isEyeClosed = eyeBlinkLeft > sens.eyeClose || eyeBlinkRight > sens.eyeClose;
        let isMouthOpen = jawOpen > sens.mouthOpen;
        let animatedJawOpen = jawOpen;
        let currentVowel: 'a' | 'i' | 'u' | 'e' | 'o' | null = null;

        // Vowel detection: 顎が開いている、または「う」「お」の口をしている、または（唇が少しでも開いていて「い」「え」の形をしている）
        if (isMouthOpen || mouthPucker > 0.2 || mouthFunnel > 0.2 || (lipDistance > 0.005 && (mouthSmile > 0.1 || mouthStretch > 0.1))) {
           isMouthOpen = true; 
           
           if (mouthSmile > 0.1 || mouthStretch > 0.1) {
              currentVowel = jawOpen > 0.10 ? 'e' : 'i';
              animatedJawOpen = Math.max(jawOpen, 0.15); // 最低限の開きを確保
           }
           else if (mouthPucker > 0.2) {
              currentVowel = 'u';
              animatedJawOpen = Math.max(jawOpen, 0.2);
           }
           else if (mouthFunnel > 0.2) {
              currentVowel = 'o';
              animatedJawOpen = Math.max(jawOpen, 0.2);
           }
           else if (jawOpen > sens.mouthOpen) {
              currentVowel = 'a';
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
             animatedJawOpen = currentVowel ? 0.5 : 0;
           } else {
             const lipSyncValue = (Math.sin(time / 50) * 0.5 + 0.5) * 0.4;
             animatedJawOpen = Math.max(jawOpen, lipSyncValue);
             isMouthOpen = animatedJawOpen > 0.1;
           }
        }

        setIsTracking(true);

        if (coords) {
          const { leftEye, rightEye, mouth } = coords;
          const pX = smoothedX * 0.4;
          const pY = smoothedY * 0.4;

          const drawEye = (eye: any, isClosed: boolean, isLeft: boolean) => {
            if (!eye) return;
            const sc = isLeft ? partScalesRef.current.leftEye : partScalesRef.current.rightEye;
            const x = eye.x * cw;
            const y = eye.y * ch;
            const w = eye.width * cw * sc;
            const h = eye.height * ch * sc;
            const ox = x + (eye.width * cw - w) / 2; // center after scale
            const oy = y + (eye.height * ch - h) / 2;
            const skin = customColors?.[isLeft ? 'leftEye' : 'rightEye'] || sampledColorsRef.current[isLeft ? 'leftEye' : 'rightEye'];
            
            ctx.save();
            ctx.filter = `blur(${Math.max(6, h * 0.25)}px)`;
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.ellipse(ox + w/2, oy + h/2, w/2 + 5, h/2 + 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Semi-transparent while this specific part is being dragged
            const thisDragged = isDraggingRef.current && selectedPartRef.current === (isLeft ? 'leftEye' : 'rightEye');
            ctx.save();
            if (thisDragged) ctx.globalAlpha = 0.35;
            ctx.translate(ox + w/2 + pX, oy + h/2 + pY);
            if (isClosed) {
                if (selectedEyeImgRef.current) {
                    // Mirror the SVG for the left eye (right eye is the "base")
                    if (isLeft) ctx.scale(-1, 1);
                    ctx.drawImage(selectedEyeImgRef.current, -w/2, -h/2, w, h);
                } else {
                    // Fallback
                    const lashColor = coords?.lashColorHex || '#222222';
                    ctx.strokeStyle = lashColor;
                    ctx.lineWidth = Math.max(0.5, h * 0.04);
                    ctx.beginPath();
                    ctx.moveTo(-w/2, h * 0.2);
                    ctx.quadraticCurveTo(0, h * 0.4, w/2, h * 0.2);
                    ctx.stroke();
                }
            } else {
                ctx.drawImage(img, eye.x * cw, eye.y * ch, eye.width * cw, eye.height * ch, -w/2, -h/2, w, h);
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
             const mh = mouth.height * ch * msc;
             const mox = mx + (mouth.width * cw - mw) / 2;
             const moy = my + (mouth.height * ch - mh) / 2;
             const skin = customColors?.mouth || sampledColorsRef.current.mouth;
             
             ctx.save();
             ctx.filter = `blur(${Math.max(6, mh * 0.25)}px)`;
             ctx.fillStyle = skin;
             ctx.beginPath();
             ctx.ellipse(mox + mw/2, moy + mh/2, mw/2 + 5, mh/2 + 5, 0, 0, Math.PI * 2);
             ctx.fill();
             ctx.restore();

             const mouthDragged = isDraggingRef.current && selectedPartRef.current === 'mouth';
             ctx.save();
             if (mouthDragged) ctx.globalAlpha = 0.35;
             ctx.translate(mox + mw/2 + pX, moy + mh/2 + pY);
             if (selectedMouthImgRef.current) {
                 // カスタムパーツがある場合は、開口度合いに応じて縦方向にスケール（上端固定）
                 const stretchY = Math.max(0.1, animatedJawOpen * 3.0);
                 ctx.translate(0, mh/2 * (stretchY - 1));
                 ctx.scale(1, stretchY);
                 ctx.drawImage(selectedMouthImgRef.current, -mw/2, -mh/2, mw, mh);
             } else {
                 if (isMouthOpen) {
                     // デフォルトの開口フォールバック
                     let rx = mw/2;
                     let ry = mh * animatedJawOpen * 2.0;
                     rx = Number.isFinite(rx) ? Math.max(0.1, Math.abs(rx)) : 10;
                     ry = Number.isFinite(ry) ? Math.max(0.1, Math.abs(ry)) : 10;
                     ctx.fillStyle = '#6b1b1b';
                     ctx.beginPath();
                     ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                     ctx.fill();
                 } else {
                     if (coords.mouthState === 'open') {
                         // デフォルトの閉口フォールバック（元の絵が開口の場合）
                         ctx.save();
                         ctx.strokeStyle = coords?.lashColorHex || '#222222';
                         ctx.lineWidth = Math.max(1, mh * 0.08);
                         ctx.beginPath();
                         ctx.moveTo(-mw * 0.4, 0);
                         ctx.quadraticCurveTo(0, mh * 0.15, mw * 0.4, 0);
                         ctx.stroke();
                         ctx.restore();
                     } else {
                         // 元の絵そのまま
                         ctx.drawImage(img, mouth.x * cw, mouth.y * ch, mouth.width * cw, mouth.height * ch, -mw/2, -mh/2, mw, mh);
                     }
                 }
             }
             ctx.restore();
          }
        }
      } else {
        setIsTracking(false);
      }
      ctx.restore();
    };

    initMediaPipe();
    return () => {
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
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: isPickingColor ? 'crosshair' : (selectedPart && showTools ? 'grab' : 'default'), touchAction: 'none' }}
      />
      {isPickingColor && <div style={{ position: 'absolute', top: '4rem', background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '1rem' }}>画像から色を抽出したい場所をタップしてください</div>}
      
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 40 }}>
        <button 
          onClick={() => navigate('/settings')} 
          style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', color: 'white', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          title="設定に戻る"
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)'}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.375rem 0.375rem 0.375rem 1rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'white', fontWeight: 500, letterSpacing: '0.025em' }}>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isTracking ? '#4ade80' : '#f87171', boxShadow: `0 0 8px ${isTracking ? '#4ade80' : '#f87171'}` }} />
             {isTracking ? 'TRACKING' : 'STANDBY'}
          </div>
          <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
          <button 
            onClick={() => {
              const next = !showTools;
              setShowTools(next);
              if (next && !selectedPart) setSelectedPart('leftEye');
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



      {/* 選択中パーツのスケール・色調整パネル */}
      {showTools && selectedPart && avatarCoords?.[selectedPart] && !isDragging && (
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
            border: `1px solid ${selectedPart === 'leftEye' ? '#ef4444' : selectedPart === 'rightEye' ? '#3b82f6' : '#22c55e'}`,
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
          {/* パーツ切り替えタブ */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}>
            {(['leftEye', 'rightEye', 'mouth'] as const).map(part => (
              <button
                key={part}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPart(part);
                }}
                style={{
                  flex: 1,
                  padding: '0.4rem 0',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: selectedPart === part ? (part === 'leftEye' ? '#ef4444' : part === 'rightEye' ? '#3b82f6' : '#22c55e') : 'rgba(255,255,255,0.1)',
                  color: selectedPart === part ? 'white' : '#9ca3af',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {part === 'leftEye' ? '👁 左目' : part === 'rightEye' ? '👁 右目' : '👄 口'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>ドラッグで移動</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => {
                 if (partsLibrary) {
                    const category = selectedPart === 'mouth' ? partsLibrary.mouths : partsLibrary.eyes;
                    const currentId = selectedPart === 'mouth' ? avatarCoords.selectedMouthId : avatarCoords.selectedEyeId;
                    const others = category.filter(item => item.id !== currentId).sort(() => Math.random() - 0.5).slice(0, 3);
                    setCandidates(others);
                    setCandidateSelector(selectedPart);
                 }
              }} style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer' }}>
                🔄 変更
              </button>
              <button onClick={() => setSelectedPart(null)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>肌色</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => { setIsPickingColor(selectedPart); setShowTools(false); }} style={{ fontSize: '0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>🕸 スポイト</button>
              <input type="color" value={customSkinColors?.[selectedPart] || sampledColors[selectedPart] || '#ffcccc'} onChange={(e) => handleColorChange(selectedPart, e.target.value)} style={{ width: '2rem', height: '2rem', borderRadius: '0.25rem', cursor: 'pointer', padding: 0, border: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.625rem', color: '#9ca3af', display: 'block', marginBottom: '0.2rem' }}>幅</label><input type="range" min="0" max="500" value={avatarCoords[selectedPart]!.width * 1000} onChange={(e) => handleCoordChange(selectedPart, 'width', parseInt(e.target.value) / 1000)} style={{ width: '100%' }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.625rem', color: '#9ca3af', display: 'block', marginBottom: '0.2rem' }}>高さ</label><input type="range" min="0" max="500" value={avatarCoords[selectedPart]!.height * 1000} onChange={(e) => handleCoordChange(selectedPart, 'height', parseInt(e.target.value) / 1000)} style={{ width: '100%' }} /></div>
          </div>
          <div>
            <label style={{ fontSize: '0.625rem', color: '#9ca3af', display: 'block', marginBottom: '0.2rem' }}>拡大縮小 ({(partScales[selectedPart] * 100).toFixed(0)}%)</label>
            <input type="range" min="20" max="300" value={partScales[selectedPart] * 100} onChange={(e) => setPartScales(s => ({ ...s, [selectedPart]: parseInt(e.target.value) / 100 }))} style={{ width: '100%' }} />
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

      {/* 枠外タップで閉じるオーバーレイ */}
      {showTools && (
        <div
          onClick={() => setShowTools(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 49,
            background: 'transparent',
          }}
        />
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
                    <img src={`/parts/${c.file}`} alt={c.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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
