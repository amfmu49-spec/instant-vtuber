import htm from 'https://esm.sh/htm';

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback } = React;

// MediaPipe Model paths and configurations
const LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const VISION_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs";
const WASM_RESOLVER_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm";

// Preset configurations
const PRESETS = [
    { id: 'girl', name: 'Anime Girl', url: 'presets/girl.png' },
    { id: 'boy', name: 'Cyberpunk Boy', url: 'presets/boy.png' },
    { id: 'cat', name: 'Cute Cat', url: 'presets/cat.png' }
];

const BACKGROUNDS = [
    { id: 'green', name: 'Green Screen', class: 'bg-green' },
    { id: 'bedroom', name: 'Cozy Room', class: 'bg-bedroom' },
    { id: 'studio', name: 'Studio', class: 'bg-studio' },
    { id: 'gradient', name: 'Gradient', class: 'bg-gradient' }
];

const ACCESSORIES = [
    { id: 'none', name: 'なし', emoji: '❌' },
    { id: 'glasses', name: 'サングラス', emoji: '😎' },
    { id: 'crown', name: 'クラウン', emoji: '👑' },
    { id: 'cat-ears', name: 'ネコミミ', emoji: '🐱' },
    { id: 'mustache', name: 'ひげ', emoji: ' mustache' } // Custom draw or emoji '👨'
];

// Helper: Landmark Indices for Eyes & Mouth
const EYE_L_LIDS = [382, 381, 380, 374, 373, 385, 386, 387, 388, 390];
const EYE_L_CENTER = 373; 
const EYE_R_LIDS = [7, 163, 144, 145, 153, 154, 155, 173, 157, 158, 159, 160, 161, 246];
const EYE_R_CENTER = 145;

const MOUTH_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 95, 88, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415];
const MOUTH_CENTER_INDEX = 13; // Upper inner center as reference

// Main App Component
function App() {
    // Current avatar and state
    const [selectedAvatar, setSelectedAvatar] = useState(PRESETS[0]);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [trackingStatus, setTrackingStatus] = useState('loading'); // loading, idle, tracking, error
    const [useWebcam, setUseWebcam] = useState(true);
    const [useAudio, setUseAudio] = useState(false);
    
    // Sensitivity and parameter settings
    const [settings, setSettings] = useState({
        headMove: 1.0,
        eyeBlink: 1.2,
        mouthOpen: 1.0,
        smoothing: 0.6 // EMA alpha: 1.0 = instant, 0.1 = extremely smooth
    });
    
    const [activeBg, setActiveBg] = useState('gradient');
    const [activeAccessory, setActiveAccessory] = useState('none');
    
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // Shared references for synchronization between tracker and canvas
    const currentFrameDataRef = useRef({
        landmarks: null,
        blendshapes: {},
        rotation: { roll: 0, yaw: 0, pitch: 0 },
        translation: { x: 0, y: 0, z: 0 },
        audioMouthScore: 0
    });
    
    const calibrationRef = useRef({
        neutralRotation: { roll: 0, yaw: 0, pitch: 0 },
        neutralPosition: { x: 0, y: 0, z: 0 },
        isCalibrated: false
    });

    const isCalibratingRef = useRef(false);
    const [calibrationCountdown, setCalibrationCountdown] = useState(null);
    
    // Hooks & methods
    const currentAvatarUrl = uploadedImage || selectedAvatar.url;

    // Trigger calibration sequence
    const triggerCalibration = useCallback(() => {
        if (trackingStatus !== 'tracking' && useWebcam) return;
        isCalibratingRef.current = true;
        setCalibrationCountdown(3);
    }, [trackingStatus, useWebcam]);

    // Countdown effect for calibration
    useEffect(() => {
        if (calibrationCountdown === null) return;
        if (calibrationCountdown === 0) {
            // Perform calibration
            const currentData = currentFrameDataRef.current;
            if (currentData.rotation) {
                calibrationRef.current.neutralRotation = { ...currentData.rotation };
                calibrationRef.current.neutralPosition = { ...currentData.translation };
                calibrationRef.current.isCalibrated = true;
            }
            setCalibrationCountdown(null);
            isCalibratingRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            setCalibrationCountdown(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [calibrationCountdown]);

    return html`
        <div class="app-container">
            <header>
                <div class="logo-section">
                    <h1>✨ Instant VTuber</h1>
                    <p>1枚のキャラクター画像を送るだけで誰でもバーチャル配信者になれるWebアプリ</p>
                </div>
                <div class="status-bar">
                    <div class="status-indicator">
                        <span class="status-dot ${trackingStatus === 'tracking' ? 'active' : trackingStatus === 'loading' ? 'loading' : trackingStatus === 'error' ? 'error' : ''}"></span>
                        <span>${trackingStatus === 'tracking' ? 'トラッキング中' : trackingStatus === 'loading' ? '初期化中...' : trackingStatus === 'error' ? 'エラー: カメラが見つからないか許可されていません' : 'Webカメラ待機中'}</span>
                    </div>
                </div>
            </header>

            <div class="workspace">
                <!-- Left Column: Rendering Canvas -->
                <div class="avatar-view bg-${activeBg}">
                    ${trackingStatus === 'loading' && html`
                        <div class="loading-container">
                            <div class="spinner"></div>
                            <div class="loading-text">Face Landmarker モデルと WebGL レンダラーを読み込んでいます...</div>
                        </div>
                    `}
                    
                    ${calibrationCountdown !== null && html`
                        <div class="calibrating-overlay">
                            <div class="countdown">${calibrationCountdown}</div>
                            <div class="calibrating-text">カメラを正面に見つめ、無表情をキープしてください</div>
                        </div>
                    `}

                    <!-- Main Three.js Canvas -->
                    <div id="canvas-container">
                        <${AvatarCanvas} 
                            avatarUrl=${currentAvatarUrl}
                            currentFrameDataRef=${currentFrameDataRef}
                            calibrationRef=${calibrationRef}
                            settings=${settings}
                            activeAccessory=${activeAccessory}
                            isRecording=${isRecording}
                            setTrackingStatus=${setTrackingStatus}
                        />
                    </div>

                    <!-- Webcam Tracker Component (hidden but manages MediaPipe) -->
                    <${WebcamTracker} 
                        useWebcam=${useWebcam}
                        useAudio=${useAudio}
                        settings=${settings}
                        currentFrameDataRef=${currentFrameDataRef}
                        setTrackingStatus=${setTrackingStatus}
                    />
                </div>

                <!-- Right Column: Controls -->
                <div class="control-panel">
                    <!-- Preset / Upload Card -->
                    <div class="panel-card">
                        <h2>👥 キャラクターの選択</h2>
                        <div class="presets-grid">
                            ${PRESETS.map(preset => html`
                                <div 
                                    key=${preset.id}
                                    class="preset-item ${selectedAvatar.id === preset.id && !uploadedImage ? 'active' : ''}"
                                    onClick=${() => {
                                        setUploadedImage(null);
                                        setSelectedAvatar(preset);
                                    }}
                                >
                                    <img src=${preset.url} alt=${preset.name} />
                                </div>
                            `)}
                        </div>
                        
                        <${ImageUploadZone} 
                            onImageUploaded=${(imgUrl) => {
                                setUploadedImage(imgUrl);
                            }}
                        />
                    </div>

                    <!-- Input Settings Mode -->
                    <div class="panel-card">
                        <h2>⚙️ トラッキング設定</h2>
                        <div class="control-group">
                            <div style=${{ display: 'flex', gap: '10px' }}>
                                <button 
                                    class="btn ${useWebcam ? 'btn-primary' : 'btn-secondary'}" 
                                    style=${{ flex: 1 }}
                                    onClick=${() => {
                                        setUseWebcam(true);
                                        setUseAudio(false);
                                    }}
                                >
                                    📷 Webカメラ
                                </button>
                                <button 
                                    class="btn ${useAudio ? 'btn-primary' : 'btn-secondary'}"
                                    style=${{ flex: 1 }}
                                    onClick=${() => {
                                        setUseWebcam(false);
                                        setUseAudio(true);
                                    }}
                                >
                                    🎤 マイク (リップシンク)
                                </button>
                            </div>

                            ${useWebcam && html`
                                <button class="btn btn-secondary" onClick=${triggerCalibration}>
                                    🎯 キャリブレーション（姿勢補正）
                                </button>
                            `}

                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>顔の回転感度</span>
                                    <span class="slider-value">${settings.headMove.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0.2" max="2.0" step="0.1" 
                                    value=${settings.headMove}
                                    onChange=${e => setSettings(prev => ({ ...prev, headMove: parseFloat(e.target.value) }))}
                                />
                            </div>

                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>まばたき感度</span>
                                    <span class="slider-value">${settings.eyeBlink.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0.5" max="2.0" step="0.1" 
                                    value=${settings.eyeBlink}
                                    onChange=${e => setSettings(prev => ({ ...prev, eyeBlink: parseFloat(e.target.value) }))}
                                />
                            </div>

                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>口の開き感度</span>
                                    <span class="slider-value">${settings.mouthOpen.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0.5" max="2.0" step="0.1" 
                                    value=${settings.mouthOpen}
                                    onChange=${e => setSettings(prev => ({ ...prev, mouthOpen: parseFloat(e.target.value) }))}
                                />
                            </div>

                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>動きの平滑化 (EMA)</span>
                                    <span class="slider-value">${settings.smoothing.toFixed(2)}</span>
                                </div>
                                <input 
                                    type="range" min="0.1" max="0.9" step="0.05" 
                                    value=${settings.smoothing}
                                    onChange=${e => setSettings(prev => ({ ...prev, smoothing: parseFloat(e.target.value) }))}
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Customizations Card (Background & Accessories) -->
                    <div class="panel-card">
                        <h2>🎨 背景 & アクセサリー</h2>
                        <div class="control-group">
                            <div class="slider-label"><span>背景の選択</span></div>
                            <div class="bg-options">
                                ${BACKGROUNDS.map(bg => html`
                                    <button 
                                        key=${bg.id}
                                        class="bg-option-btn bg-${bg.id} ${activeBg === bg.id ? 'active' : ''}"
                                        onClick=${() => setActiveBg(bg.id)}
                                    >
                                        <span>${bg.name}</span>
                                    </button>
                                `)}
                            </div>

                            <div class="slider-label" style=${{ marginTop: '10px' }}><span>アクセサリー</span></div>
                            <div class="accessory-options">
                                ${ACCESSORIES.map(acc => html`
                                    <button 
                                        key=${acc.id}
                                        class="accessory-btn ${activeAccessory === acc.id ? 'active' : ''}"
                                        onClick=${() => setActiveAccessory(acc.id)}
                                    >
                                        <span class="accessory-btn-icon">${acc.emoji}</span>
                                        <span>${acc.name}</span>
                                    </button>
                                `)}
                            </div>
                        </div>
                    </div>

                    <!-- Recording / Exporting Card -->
                    <${RecordingCard} 
                        isRecording=${isRecording} 
                        setIsRecording=${setIsRecording}
                        recordingTime=${recordingTime}
                        setRecordingTime=${setRecordingTime}
                    />
                </div>
            </div>
            
            <footer>
                <p>© 2026 Instant VTuber App - Powered by MediaPipe Tasks Vision & Three.js</p>
            </footer>
        </div>
    `;
}

// Drag & Drop Image Upload Component
function ImageUploadZone({ onImageUploaded }) {
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const processFile = (file) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                onImageUploaded(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    return html`
        <div 
            class="upload-zone ${dragActive ? 'drag-active' : ''}"
            onDragEnter=${handleDrag}
            onDragLeave=${handleDrag}
            onDragOver=${handleDrag}
            onDrop=${handleDrop}
            onClick=${() => fileInputRef.current.click()}
        >
            <input 
                ref=${fileInputRef}
                type="file" 
                style=${{ display: 'none' }} 
                accept="image/*"
                onChange=${handleChange}
            />
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-8m0 8l-4-4m4 4l4-4M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            </svg>
            <p>画像をアップロード</p>
            <span>クリックまたはドラッグ＆ドロップ</span>
        </div>
    `;
}

// MediaPipe FaceLandmarker Tracker component
function WebcamTracker({ useWebcam, useAudio, settings, currentFrameDataRef, setTrackingStatus }) {
    const videoRef = useRef(null);
    const canvasOverlayRef = useRef(null);
    const landmarkerRef = useRef(null);
    const activeRef = useRef({ useWebcam, useAudio });
    const audioContextRef = useRef(null);
    const audioAnalyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Keep active state ref synchronized
    useEffect(() => {
        activeRef.current = { useWebcam, useAudio };
    }, [useWebcam, useAudio]);

    // Setup Audio monitoring for Lip Sync
    useEffect(() => {
        if (!useAudio) {
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            return;
        }

        let audioStream = null;
        async function initAudio() {
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContextClass();
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                
                const source = audioCtx.createMediaStreamSource(audioStream);
                source.connect(analyser);
                
                audioContextRef.current = audioCtx;
                audioAnalyserRef.current = analyser;
                setTrackingStatus('tracking');
            } catch (err) {
                console.error("Microphone access failed:", err);
                setTrackingStatus('error');
            }
        }

        initAudio();

        return () => {
            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [useAudio]);

    // Initialize MediaPipe Face Landmarker
    useEffect(() => {
        let active = true;
        let stream = null;

        async function initMediaPipe() {
            try {
                const { FaceLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);
                const filesetResolver = await FilesetResolver.forVisionTasks(WASM_RESOLVER_URL);
                
                const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL },
                    runningMode: "VIDEO",
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true,
                    numFaces: 1
                });

                if (!active) return;
                landmarkerRef.current = landmarker;
                setTrackingStatus('idle');

                if (useWebcam) {
                    startWebcam();
                }
            } catch (err) {
                console.error("MediaPipe initialization failed:", err);
                if (active) setTrackingStatus('error');
            }
        }

        async function startWebcam() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener('loadeddata', predictLoop);
                }
            } catch (err) {
                console.error("Camera access failed:", err);
                setTrackingStatus('error');
            }
        }

        initMediaPipe();

        return () => {
            active = false;
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [useWebcam]);

    // Webcam prediction loop
    const predictLoop = async () => {
        const video = videoRef.current;
        const landmarker = landmarkerRef.current;
        
        if (!video || !landmarker || !activeRef.current.useWebcam) return;
        
        if (video.readyState >= 2) {
            const timestamp = performance.now();
            const results = landmarker.detectForVideo(video, timestamp);
            
            // Draw overlay tracking wireframe for reassurance
            drawTrackingMesh(results);
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                setTrackingStatus('tracking');
                const landmarks = results.faceLandmarks[0];
                const blendshapes = results.faceBlendshapes[0]?.categories || [];
                
                // Convert blendshapes list to simple map
                const blendshapeMap = {};
                blendshapes.forEach(cat => {
                    blendshapeMap[cat.categoryName] = cat.score;
                });
                
                // Estimate Head Rotation and displacement
                const rotation = estimateHeadRotation(landmarks);
                const translation = estimateHeadTranslation(landmarks);

                currentFrameDataRef.current = {
                    landmarks,
                    blendshapes: blendshapeMap,
                    rotation,
                    translation,
                    audioMouthScore: 0
                };
            }
        }

        // Process audio in the loop if audio mode is active
        if (activeRef.current.useAudio && audioAnalyserRef.current) {
            const analyser = audioAnalyserRef.current;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const mouthScore = Math.min(1.0, avg / 45); // threshold scale
            
            currentFrameDataRef.current = {
                landmarks: null,
                blendshapes: {},
                rotation: { roll: 0, yaw: 0, pitch: 0 },
                translation: { x: 0, y: 0, z: 0 },
                audioMouthScore: mouthScore
            };
        }
        
        animationFrameRef.current = requestAnimationFrame(predictLoop);
    };

    // Draw the green points on the PiP camera window
    const drawTrackingMesh = (results) => {
        const canvas = canvasOverlayRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            ctx.fillStyle = '#10b981';
            const landmarks = results.faceLandmarks[0];
            // Draw a subset of points for performance and clarity
            for (let i = 0; i < landmarks.length; i += 4) {
                const pt = landmarks[i];
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    };

    // Estimate rotation angles (Roll, Pitch, Yaw)
    const estimateHeadRotation = (landmarks) => {
        const pLeft = landmarks[263];  // outer left eye
        const pRight = landmarks[33];   // outer right eye
        const pNose = landmarks[4];     // nose tip
        const pChin = landmarks[152];   // chin
        
        // Roll: Tilt angle in XY plane
        const dx = pLeft.x - pRight.x;
        const dy = pLeft.y - pRight.y;
        const roll = Math.atan2(dy, dx);
        
        // Yaw: Left/Right turning
        const distL = Math.hypot(pNose.x - pLeft.x, pNose.y - pLeft.y);
        const distR = Math.hypot(pNose.x - pRight.x, pNose.y - pRight.y);
        const yaw = (distL - distR) / (distL + distR) * 2.2;
        
        // Pitch: Up/Down tilting
        const eyeCenterY = (pLeft.y + pRight.y) / 2;
        const distNoseToEyes = pNose.y - eyeCenterY;
        const distNoseToChin = pChin.y - pNose.y;
        const pitch = (distNoseToChin - distNoseToEyes) / (distNoseToChin + distNoseToEyes) * 1.5 - 0.4;
        
        return { roll, yaw, pitch };
    };

    // Estimate translation (displacement offset)
    const estimateHeadTranslation = (landmarks) => {
        // Average face position relative to screen center
        const pNose = landmarks[4];
        return {
            x: (pNose.x - 0.5) * 1.5,
            y: (0.5 - pNose.y) * 1.5,
            z: pNose.z * 1.5
        };
    };

    return html`
        <div class="webcam-pip" style=${{ display: useWebcam ? 'block' : 'none' }}>
            <video ref=${videoRef} autoplay playsinline muted></video>
            <canvas ref=${canvasOverlayRef} width="160" height="120"></canvas>
            <div class="pip-label">カメラプレビュー</div>
        </div>
    `;
}

// Three.js Canvas component that warps the uploaded/preset face image
function AvatarCanvas({ avatarUrl, currentFrameDataRef, calibrationRef, settings, activeAccessory, setTrackingStatus }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const meshRef = useRef(null);
    const accessorySpriteRef = useRef(null);
    
    // Store source data
    const sourceDataRef = useRef({
        landmarks: null,
        borderPoints: [],
        allPoints: [],
        triangulationIndices: [],
        basePositions: null, // Float32Array
        uvs: null, // Float32Array
        aspectRatio: 1.0,
        texture: null
    });

    // Exponential Moving Average state for smoothing
    const emaRef = useRef({
        roll: 0, yaw: 0, pitch: 0,
        tx: 0, ty: 0, tz: 0,
        eyeBlinkL: 0, eyeBlinkR: 0,
        mouthOpen: 0, mouthSmile: 0
    });

    // Run face detection on the uploaded/preset character image
    const detectSourceFace = useCallback(async (imageUrl) => {
        try {
            setTrackingStatus('loading');
            
            // 1. Load image and extract width/height
            const img = new Image();
            img.src = imageUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            const aspect = img.width / img.height;
            sourceDataRef.current.aspectRatio = aspect;

            // 2. Initialize temporary FaceLandmarker for static image detection
            const { FaceLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);
            const filesetResolver = await FilesetResolver.forVisionTasks(WASM_RESOLVER_URL);
            const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL },
                runningMode: "IMAGE",
                numFaces: 1
            });
            
            const results = landmarker.detect(img);
            landmarker.close();

            if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
                alert("キャラクター画像から顔を検出できませんでした。正面を向いた鮮明な顔画像を使用してください。");
                setTrackingStatus('idle');
                return;
            }

            const faceLandmarks = results.faceLandmarks[0]; // 468 points
            sourceDataRef.current.landmarks = faceLandmarks;

            // 3. Create boundary points for the image border to ensure full screen warp
            const borderPoints = [];
            // Corners
            borderPoints.push({ x: 0, y: 0, z: 0 }); // top-left
            borderPoints.push({ x: 1, y: 0, z: 0 }); // top-right
            borderPoints.push({ x: 1, y: 1, z: 0 }); // bottom-right
            borderPoints.push({ x: 0, y: 1, z: 0 }); // bottom-left
            // Edge Midpoints
            borderPoints.push({ x: 0.5, y: 0, z: 0 });
            borderPoints.push({ x: 1, y: 0.5, z: 0 });
            borderPoints.push({ x: 0.5, y: 1, z: 0 });
            borderPoints.push({ x: 0, y: 0.5, z: 0 });
            // Intermediate boundary padding points
            borderPoints.push({ x: 0.25, y: 0, z: 0 });
            borderPoints.push({ x: 0.75, y: 0, z: 0 });
            borderPoints.push({ x: 1, y: 0.25, z: 0 });
            borderPoints.push({ x: 1, y: 0.75, z: 0 });
            borderPoints.push({ x: 0.75, y: 1, z: 0 });
            borderPoints.push({ x: 0.25, y: 1, z: 0 });
            borderPoints.push({ x: 0, y: 0.75, z: 0 });
            borderPoints.push({ x: 0, y: 0.25, z: 0 });

            sourceDataRef.current.borderPoints = borderPoints;
            
            // Combine all points: 468 face landmarks + 16 border points
            const allPoints = [...faceLandmarks, ...borderPoints];
            sourceDataRef.current.allPoints = allPoints;

            // 4. Triangulate all points using Delaunator
            const flatPoints = [];
            allPoints.forEach(pt => flatPoints.push(pt.x, pt.y));
            
            const delaunay = new Delaunator(flatPoints);
            sourceDataRef.current.triangulationIndices = delaunay.triangles;

            // 5. Construct Initial positions and UV arrays for WebGL Mesh
            const count = allPoints.length;
            const basePositions = new Float32Array(count * 3);
            const uvs = new Float32Array(count * 2);

            for (let i = 0; i < count; i++) {
                const pt = allPoints[i];
                // Position in WebGL coordinate space: centered and scaled
                basePositions[i * 3] = (pt.x - 0.5) * 2.0 * aspect;
                basePositions[i * 3 + 1] = (0.5 - pt.y) * 2.0;
                basePositions[i * 3 + 2] = 0;

                // UV texture coordinate: mapping (x, y) direct
                uvs[i * 2] = pt.x;
                uvs[i * 2 + 1] = 1.0 - pt.y;
            }

            sourceDataRef.current.basePositions = basePositions;
            sourceDataRef.current.uvs = uvs;

            // 6. Build or Update Three.js Mesh
            buildMesh(imageUrl);

            setTrackingStatus('idle');
        } catch (err) {
            console.error("Static face landmark extraction failed:", err);
            setTrackingStatus('error');
        }
    }, []);

    // Create the Three.js scene, camera, renderer, and mesh
    const buildMesh = (imageUrl) => {
        const source = sourceDataRef.current;
        if (!source.basePositions) return;

        // Initialize Three.js objects if not done yet
        if (!sceneRef.current) {
            const container = mountRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;

            const scene = new THREE.Scene();
            // Orthographic Camera for clean 2D layout rendering
            const camera = new THREE.OrthographicCamera(-width / height, width / height, 1, -1, 0.1, 100);
            camera.position.z = 5;

            const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('avatar-canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(window.devicePixelRatio);

            sceneRef.current = scene;
            cameraRef.current = camera;
            rendererRef.current = renderer;

            // Resize listener
            window.addEventListener('resize', handleResize);
        }

        const scene = sceneRef.current;

        // Clean up previous mesh
        if (meshRef.current) {
            scene.remove(meshRef.current);
            meshRef.current.geometry.dispose();
            meshRef.current.material.dispose();
            meshRef.current = null;
        }

        // Build Geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(source.basePositions), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(source.uvs, 2));
        geometry.setIndex(Array.from(source.triangulationIndices));

        // Load Texture
        const loader = new THREE.TextureLoader();
        loader.load(imageUrl, (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            const material = new THREE.MeshBasicMaterial({ 
                map: texture, 
                side: THREE.DoubleSide,
                transparent: true
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            meshRef.current = mesh;
            
            // Trigger accessory reload to lay over the new mesh
            loadAccessoryTexture(activeAccessory);
        });
    };

    // Load dynamic accessories using canvas emoji rendering!
    const loadAccessoryTexture = (accessoryType) => {
        const scene = sceneRef.current;
        if (!scene) return;

        if (accessorySpriteRef.current) {
            scene.remove(accessorySpriteRef.current);
            accessorySpriteRef.current.material.dispose();
            accessorySpriteRef.current = null;
        }

        if (accessoryType === 'none') return;

        const accessory = ACCESSORIES.find(a => a.id === accessoryType);
        if (!accessory) return;

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Custom draw logic for mustache or standard emojis
        if (accessoryType === 'mustache') {
            ctx.fillStyle = '#111';
            // Draw simple stylized handlebar mustache
            ctx.beginPath();
            ctx.moveTo(256 - 80, 256);
            ctx.quadraticCurveTo(256 - 40, 256 - 50, 256, 256 - 10);
            ctx.quadraticCurveTo(256 + 40, 256 - 50, 256 + 80, 256);
            ctx.quadraticCurveTo(256 + 40, 256 + 20, 256, 256);
            ctx.quadraticCurveTo(256 - 40, 256 + 20, 256 - 80, 256);
            ctx.fill();
        } else {
            ctx.font = '360px Arial';
            ctx.fillText(accessory.emoji, 256, 256);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        // Scale down to a reasonable starting size
        sprite.scale.set(0.6, 0.6, 1);
        sprite.position.z = 0.5; // sit in front of the avatar mesh
        
        scene.add(sprite);
        accessorySpriteRef.current = sprite;
    };

    // Handle container resize
    const handleResize = () => {
        const container = mountRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        if (cameraRef.current && rendererRef.current) {
            cameraRef.current.left = -width / height;
            cameraRef.current.right = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        }
    };

    // Watch avatar changes
    useEffect(() => {
        detectSourceFace(avatarUrl);
    }, [avatarUrl, detectSourceFace]);

    // Watch accessory changes
    useEffect(() => {
        loadAccessoryTexture(activeAccessory);
    }, [activeAccessory]);

    // Main WebGL animation rendering and mesh warping loop
    useEffect(() => {
        let active = true;

        const animate = () => {
            if (!active) return;
            requestAnimationFrame(animate);

            const scene = sceneRef.current;
            const camera = cameraRef.current;
            const renderer = rendererRef.current;
            const mesh = meshRef.current;
            const source = sourceDataRef.current;

            if (!scene || !camera || !renderer || !mesh || !source.basePositions) return;

            // 1. Fetch current frame tracking coordinates
            const frameData = currentFrameDataRef.current;
            const calibration = calibrationRef.current;
            const smoothing = settings.smoothing; // EMA alpha value

            let currentRoll = 0, currentYaw = 0, currentPitch = 0;
            let currentTx = 0, currentTy = 0, currentTz = 0;
            let currentBlinkL = 0, currentBlinkR = 0;
            let currentMouthOpen = 0, currentMouthSmile = 0;

            if (frameData.landmarks) {
                // Tracking is from webcam
                currentRoll = frameData.rotation.roll;
                currentYaw = frameData.rotation.yaw;
                currentPitch = frameData.rotation.pitch;

                if (calibration.isCalibrated) {
                    currentRoll -= calibration.neutralRotation.roll;
                    currentYaw -= calibration.neutralRotation.yaw;
                    currentPitch -= calibration.neutralRotation.pitch;

                    currentTx = (frameData.translation.x - calibration.neutralPosition.x) * settings.headMove;
                    currentTy = (frameData.translation.y - calibration.neutralPosition.y) * settings.headMove;
                } else {
                    currentTx = frameData.translation.x * settings.headMove;
                    currentTy = frameData.translation.y * settings.headMove;
                }

                currentBlinkL = (frameData.blendshapes['eyeBlinkLeft'] || 0) * settings.eyeBlink;
                currentBlinkR = (frameData.blendshapes['eyeBlinkRight'] || 0) * settings.eyeBlink;
                currentMouthOpen = (frameData.blendshapes['jawOpen'] || 0) * settings.mouthOpen;
                currentMouthSmile = (frameData.blendshapes['mouthSmileLeft'] || 0) + (frameData.blendshapes['mouthSmileRight'] || 0) / 2.0;

            } else if (frameData.audioMouthScore > 0) {
                // Lip Sync fallback (microphones only)
                currentMouthOpen = frameData.audioMouthScore * settings.mouthOpen;
                
                // Add minor random breathing head movement
                const time = performance.now() * 0.001;
                currentRoll = Math.sin(time) * 0.03;
                currentYaw = Math.cos(time * 0.7) * 0.04;
                currentPitch = Math.sin(time * 0.5) * 0.02;
            }

            // Clamp blendshapes
            currentBlinkL = Math.max(0, Math.min(1.0, currentBlinkL));
            currentBlinkR = Math.max(0, Math.min(1.0, currentBlinkR));
            currentMouthOpen = Math.max(0, Math.min(1.2, currentMouthOpen));

            // 2. Apply Exponential Moving Average (EMA) smoothing filter
            const ema = emaRef.current;
            ema.roll = ema.roll * smoothing + currentRoll * (1 - smoothing);
            ema.yaw = ema.yaw * smoothing + currentYaw * (1 - smoothing);
            ema.pitch = ema.pitch * smoothing + currentPitch * (1 - smoothing);
            ema.tx = ema.tx * smoothing + currentTx * (1 - smoothing);
            ema.ty = ema.ty * smoothing + currentTy * (1 - smoothing);
            
            ema.eyeBlinkL = ema.eyeBlinkL * smoothing + currentBlinkL * (1 - smoothing);
            ema.eyeBlinkR = ema.eyeBlinkR * smoothing + currentBlinkR * (1 - smoothing);
            ema.mouthOpen = ema.mouthOpen * smoothing + currentMouthOpen * (1 - smoothing);
            ema.mouthSmile = ema.mouthSmile * smoothing + currentMouthSmile * (1 - smoothing);

            // 3. Deform the Mesh Vertices
            const posAttr = mesh.geometry.attributes.position;
            const positions = posAttr.array;
            const basePos = source.basePositions;

            // Character Nose Tip index as center of local deformations and rotations
            const noseX = basePos[4 * 3];
            const noseY = basePos[4 * 3 + 1];
            
            // Eye center coordinates
            const baseEyeL = getCenterCoords(basePos, EYE_L_LIDS);
            const baseEyeR = getCenterCoords(basePos, EYE_R_LIDS);
            const baseMouth = getCenterCoords(basePos, MOUTH_LIPS);

            // Build Rotation matrices in 2D/3D (approximate yaw, pitch, roll)
            const cosRoll = Math.cos(ema.roll);
            const sinRoll = Math.sin(ema.roll);
            const cosYaw = Math.cos(ema.yaw);
            const sinYaw = Math.sin(ema.yaw);
            const cosPitch = Math.cos(ema.pitch);
            const sinPitch = Math.sin(ema.pitch);

            const count = source.allPoints.length;

            for (let i = 0; i < count; i++) {
                if (i >= 468) {
                    // Border anchors: stay static, do not modify
                    continue;
                }

                // Initial coords
                let x = basePos[i * 3];
                let y = basePos[i * 3 + 1];
                let z = basePos[i * 3 + 2];

                // A. Local Facial Deformations (Blinks & Mouth)
                // Left Eye blink warping
                if (EYE_L_LIDS.includes(i)) {
                    let dy = y - baseEyeL.y;
                    y = baseEyeL.y + dy * (1.0 - ema.eyeBlinkL);
                }
                
                // Right Eye blink warping
                if (EYE_R_LIDS.includes(i)) {
                    let dy = y - baseEyeR.y;
                    y = baseEyeR.y + dy * (1.0 - ema.eyeBlinkR);
                }

                // Mouth opening warping
                if (MOUTH_LIPS.includes(i)) {
                    let dy = y - baseMouth.y;
                    // Lower lips stretch down, upper lips stretch up
                    y = baseMouth.y + dy * (1.0 + ema.mouthOpen * 1.6);
                    
                    // Smiling corners pull outwards
                    if (i === 61 || i === 291) {
                        let dx = x - baseMouth.x;
                        x = baseMouth.x + dx * (1.0 + ema.mouthSmile * 0.15);
                        y = y + Math.abs(dx) * ema.mouthSmile * 0.08;
                    }
                }

                // B. Global 3D Head rotation & translation (Pseudo 3D Live2D Effect)
                // Translate coordinates relative to Nose Center
                let rx = x - noseX;
                let ry = y - noseY;
                let rz = z;

                // Rotate: Yaw (around Y), Pitch (around X), Roll (around Z)
                // Yaw rotation
                let x1 = rx * cosYaw - rz * sinYaw;
                let z1 = rx * sinYaw + rz * cosYaw;
                
                // Pitch rotation
                let y2 = ry * cosPitch - z1 * sinPitch;
                let z2 = ry * sinPitch + z1 * cosPitch;

                // Roll rotation
                let x3 = x1 * cosRoll - y2 * sinRoll;
                let y3 = x1 * sinRoll + y2 * cosRoll;

                // Apply rotation, add translation, and translate back from center
                positions[i * 3] = x3 + noseX + ema.tx;
                positions[i * 3 + 1] = y3 + noseY + ema.ty;
                positions[i * 3 + 2] = z2;
            }

            // Flag WebGL geometry update
            posAttr.needsUpdate = true;

            // 4. Update Accessories Sprite position & rotation
            const sprite = accessorySpriteRef.current;
            if (sprite) {
                // Align accessory relative to standard landmarks
                let targetLandmark = 6; // Bridge of nose (for glasses)
                let yOffset = 0.0;
                let scaleMult = 1.0;

                if (activeAccessory === 'crown') {
                    targetLandmark = 10; // Forehead top
                    yOffset = 0.28;
                    scaleMult = 0.55;
                } else if (activeAccessory === 'cat-ears') {
                    targetLandmark = 10; // Forehead top
                    yOffset = 0.25;
                    scaleMult = 0.7;
                } else if (activeAccessory === 'mustache') {
                    targetLandmark = 164; // Under nose
                    yOffset = -0.02;
                    scaleMult = 0.25;
                } else if (activeAccessory === 'glasses') {
                    targetLandmark = 6; // Bridge of nose
                    yOffset = 0.02;
                    scaleMult = 0.45;
                }

                const px = positions[targetLandmark * 3];
                const py = positions[targetLandmark * 3 + 1];
                const pz = positions[targetLandmark * 3 + 2];

                // Smooth position
                sprite.position.set(px, py + yOffset, pz + 0.1);
                sprite.material.rotation = -ema.roll;

                // Scale based on face outline size (temple-to-temple distance indices 127 & 356)
                const templeL = { x: positions[356 * 3], y: positions[356 * 3 + 1] };
                const templeR = { x: positions[127 * 3], y: positions[127 * 3 + 1] };
                const faceWidth = Math.hypot(templeL.x - templeR.x, templeL.y - templeR.y);
                
                sprite.scale.set(faceWidth * scaleMult, faceWidth * scaleMult, 1);
            }

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            active = false;
        };
    }, [settings, activeAccessory]);

    // Helper: get average center of landmark indices group
    const getCenterCoords = (positions, indices) => {
        let x = 0, y = 0, z = 0;
        indices.forEach(idx => {
            x += positions[idx * 3];
            y += positions[idx * 3 + 1];
            z += positions[idx * 3 + 2];
        });
        return {
            x: x / indices.length,
            y: y / indices.length,
            z: z / indices.length
        };
    };

    return html`
        <div ref=${mountRef} style=${{ width: '100%', height: '100%', position: 'relative' }}>
            <canvas id="avatar-canvas"></canvas>
        </div>
    `;
}

// Controller Card for Video Screen recording + Audio merge
function RecordingCard({ isRecording, setIsRecording, recordingTime, setRecordingTime }) {
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioStreamRef = useRef(null);
    const timerRef = useRef(null);

    // Format seconds to MM:SS
    const formatTime = (sec) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Handle timer update
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    const startRecording = async () => {
        try {
            const canvas = document.getElementById('avatar-canvas');
            if (!canvas) return;

            // 1. Capture WebGL canvas video stream
            const videoStream = canvas.captureStream(30); // 30 FPS
            
            const combinedStream = new MediaStream();
            videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

            // 2. Try merging microphone audio
            let micStream = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
                audioStreamRef.current = micStream;
            } catch (err) {
                console.warn("Microphone not available for recording, video-only output will be created.");
            }

            // 3. Initialize MediaRecorder
            const options = { mimeType: 'video/webm;codecs=vp9' };
            let recorder;
            try {
                recorder = new MediaRecorder(combinedStream, options);
            } catch (e) {
                // Fallback to basic webm
                recorder = new MediaRecorder(combinedStream);
            }

            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                
                // Trigger file download
                const a = document.createElement('a');
                a.href = url;
                a.download = `vtuber-recording-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Clean streams
                if (audioStreamRef.current) {
                    audioStreamRef.current.getTracks().forEach(t => t.stop());
                }
                combinedStream.getTracks().forEach(t => t.stop());
            };

            recorderRef.current = recorder;
            streamRef.current = combinedStream;

            recorder.start(1000); // chunk slices
            setIsRecording(true);
        } catch (err) {
            console.error("Recording start failed:", err);
            alert("録画の開始に失敗しました。");
        }
    };

    const stopRecording = () => {
        if (recorderRef.current && isRecording) {
            recorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return html`
        <div class="panel-card">
            <h2>📹 配信の録画・録音</h2>
            <div class="control-group">
                <p style=${{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    アバターの動作画面とマイク音声を合わせてWebM形式で録画し、ローカルにダウンロードできます。
                </p>
                
                ${isRecording && html`
                    <div class="recording-bar">
                        <span class="recording-dot"></span>
                        <span>録画中: ${formatTime(recordingTime)}</span>
                    </div>
                `}

                ${!isRecording ? html`
                    <button class="btn btn-primary" onClick=${startRecording}>
                        🔴 録画を開始する
                    </button>
                ` : html`
                    <button class="btn btn-danger" onClick=${stopRecording}>
                        ⏹️ 録画を停止して保存
                    </button>
                `}
            </div>
        </div>
    `;
}

// Render root App
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(React.createElement(App));
