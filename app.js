import htm from 'https://esm.sh/htm';

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback } = React;

// MediaPipe
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
    { id: 'green', name: 'グリーンバック', style: { background: '#00b140' } },
    { id: 'studio', name: 'スタジオ', style: { background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' } },
    { id: 'neon', name: 'ネオン', style: { background: 'linear-gradient(135deg, #0d0221 0%, #190733 40%, #0d0a35 100%)' } },
    { id: 'gradient', name: 'グラデーション', style: { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' } }
];

const ACCESSORIES = [
    { id: 'none', name: 'なし', emoji: '❌' },
    { id: 'glasses', name: 'めがね', emoji: '🕶️' },
    { id: 'crown', name: 'クラウン', emoji: '👑' },
    { id: 'cat-ears', name: 'ネコミミ', emoji: '🐱' }
];

// ========== MAIN APP ==========
function App() {
    const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [cameraStatus, setCameraStatus] = useState('idle'); // idle | loading | active | error
    const [mediapipeReady, setMediapipeReady] = useState(false);
    const [useAudio, setUseAudio] = useState(false);
    const [activeBg, setActiveBg] = useState(1); // index into BACKGROUNDS
    const [activeAccessory, setActiveAccessory] = useState('none');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [settings, setSettings] = useState({
        headMove: 1.0, eyeBlink: 1.2, mouthOpen: 1.0, smoothing: 0.6
    });

    // Shared tracking data between webcam tracker and canvas
    const trackingRef = useRef({
        yaw: 0, pitch: 0, roll: 0,
        blinkL: 0, blinkR: 0,
        mouthOpen: 0, mouthSmile: 0,
        audioMouth: 0
    });

    const avatarUrl = uploadedImage || selectedPreset.url;

    return html`
        <div class="app-container">
            <header>
                <div class="logo-section">
                    <h1>✨ Instant VTuber</h1>
                    <p>1枚の画像で誰でもバーチャル配信者に！</p>
                </div>
                <div class="status-bar">
                    <div class="status-indicator">
                        <span class="status-dot ${cameraStatus === 'active' ? 'active' : cameraStatus === 'loading' ? 'loading' : cameraStatus === 'error' ? 'error' : ''}"></span>
                        <span style=${{ fontSize: '12px' }}>
                            ${cameraStatus === 'active' ? (mediapipeReady ? 'トラッキング中' : 'カメラ接続中...') :
                              cameraStatus === 'loading' ? '初期化中...' :
                              cameraStatus === 'error' ? 'カメラ許可が必要' : 'カメラ待機中'}
                        </span>
                    </div>
                </div>
            </header>

            <div class="workspace">
                <!-- LEFT: Avatar Canvas -->
                <div class="avatar-view" style=${BACKGROUNDS[activeBg].style}>
                    <${AvatarCanvas}
                        avatarUrl=${avatarUrl}
                        trackingRef=${trackingRef}
                        settings=${settings}
                        useAudio=${useAudio}
                        activeAccessory=${activeAccessory}
                    />
                    <${WebcamPip}
                        cameraStatus=${cameraStatus}
                        setCameraStatus=${setCameraStatus}
                        mediapipeReady=${mediapipeReady}
                        setMediapipeReady=${setMediapipeReady}
                        useAudio=${useAudio}
                        trackingRef=${trackingRef}
                        settings=${settings}
                    />
                </div>

                <!-- RIGHT: Controls -->
                <div class="control-panel">
                    <!-- Character Selection -->
                    <div class="panel-card">
                        <h2>👤 キャラクターを選ぶ</h2>
                        <div class="presets-grid">
                            ${PRESETS.map(preset => html`
                                <div
                                    key=${preset.id}
                                    class="preset-item ${selectedPreset.id === preset.id && !uploadedImage ? 'active' : ''}"
                                    onClick=${() => { setUploadedImage(null); setSelectedPreset(preset); }}
                                >
                                    <img src=${preset.url} alt=${preset.name} />
                                </div>
                            `)}
                        </div>
                        <${UploadZone} onImage=${url => setUploadedImage(url)} />
                    </div>

                    <!-- Camera / Mode -->
                    <div class="panel-card">
                        <h2>⚙️ トラッキング</h2>
                        <div class="control-group">
                            <div style=${{ display: 'flex', gap: '8px' }}>
                                <button
                                    class="btn ${!useAudio ? 'btn-primary' : 'btn-secondary'}"
                                    style=${{ flex: 1 }}
                                    onClick=${() => setUseAudio(false)}
                                >📷 カメラ</button>
                                <button
                                    class="btn ${useAudio ? 'btn-primary' : 'btn-secondary'}"
                                    style=${{ flex: 1 }}
                                    onClick=${() => setUseAudio(true)}
                                >🎤 マイク</button>
                            </div>

                            ${!useAudio && cameraStatus === 'idle' && html`
                                <button class="btn btn-primary" onClick=${() => setCameraStatus('start')}>
                                    📷 カメラを起動する
                                </button>
                            `}
                            ${!useAudio && cameraStatus === 'error' && html`
                                <div style=${{ fontSize: '12px', color: '#ef4444', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', lineHeight: 1.6 }}>
                                    ⚠️ カメラへのアクセスが拒否されました。<br/>
                                    ブラウザのアドレスバー左のアイコン → カメラを「許可」に変更して、ページを再読み込みしてください。
                                </div>
                            `}

                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>頭の動き</span>
                                    <span class="slider-value">${settings.headMove.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0.2" max="2.0" step="0.1" value=${settings.headMove}
                                    onChange=${e => setSettings(p => ({ ...p, headMove: +e.target.value }))} />
                            </div>
                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>まばたき</span>
                                    <span class="slider-value">${settings.eyeBlink.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0.5" max="2.0" step="0.1" value=${settings.eyeBlink}
                                    onChange=${e => setSettings(p => ({ ...p, eyeBlink: +e.target.value }))} />
                            </div>
                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>口の開き</span>
                                    <span class="slider-value">${settings.mouthOpen.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0.5" max="2.0" step="0.1" value=${settings.mouthOpen}
                                    onChange=${e => setSettings(p => ({ ...p, mouthOpen: +e.target.value }))} />
                            </div>
                            <div class="slider-container">
                                <div class="slider-label">
                                    <span>スムージング</span>
                                    <span class="slider-value">${settings.smoothing.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0.05" max="0.9" step="0.05" value=${settings.smoothing}
                                    onChange=${e => setSettings(p => ({ ...p, smoothing: +e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    <!-- Background -->
                    <div class="panel-card">
                        <h2>🎨 背景 & アクセサリー</h2>
                        <div class="control-group">
                            <div class="slider-label"><span>背景</span></div>
                            <div class="bg-options">
                                ${BACKGROUNDS.map((bg, i) => html`
                                    <button
                                        key=${bg.id}
                                        class="bg-option-btn ${activeBg === i ? 'active' : ''}"
                                        style=${bg.style}
                                        onClick=${() => setActiveBg(i)}
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

                    <!-- Recording -->
                    <${RecordingCard}
                        isRecording=${isRecording}
                        setIsRecording=${setIsRecording}
                        recordingTime=${recordingTime}
                        setRecordingTime=${setRecordingTime}
                    />
                </div>
            </div>
        </div>
    `;
}

// ========== UPLOAD ZONE ==========
function UploadZone({ onImage }) {
    const [drag, setDrag] = useState(false);
    const inputRef = useRef(null);

    const process = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => onImage(e.target.result);
        reader.readAsDataURL(file);
    };

    return html`
        <div
            class="upload-zone ${drag ? 'drag-active' : ''}"
            onDragEnter=${e => { e.preventDefault(); setDrag(true); }}
            onDragOver=${e => { e.preventDefault(); setDrag(true); }}
            onDragLeave=${e => { e.preventDefault(); setDrag(false); }}
            onDrop=${e => { e.preventDefault(); setDrag(false); process(e.dataTransfer.files[0]); }}
            onClick=${() => inputRef.current.click()}
        >
            <input ref=${inputRef} type="file" accept="image/*" style=${{ display:'none' }} onChange=${e => process(e.target.files[0])} />
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style=${{ marginBottom:'8px', color:'var(--text-muted)' }}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4-4 4 4 4-8 4 4M4 20h16" />
            </svg>
            <p>自分の画像をアップロード</p>
            <span>クリック / ドラッグ＆ドロップ</span>
        </div>
    `;
}

// ========== WEBCAM + MEDIAPIPE ==========
function WebcamPip({ cameraStatus, setCameraStatus, mediapipeReady, setMediapipeReady, useAudio, trackingRef, settings }) {
    const videoRef = useRef(null);
    const pipCanvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const animRef = useRef(null);
    const streamRef = useRef(null);
    const emaRef = useRef({ roll:0, yaw:0, pitch:0, blinkL:0, blinkR:0, mouth:0 });

    // Audio mode
    useEffect(() => {
        if (!useAudio) return;
        let stream;
        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                ctx.createMediaStreamSource(stream).connect(analyser);
                audioCtxRef.current = ctx;
                analyserRef.current = analyser;
                setCameraStatus('active');

                const loop = () => {
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(data);
                    const avg = data.reduce((s,v) => s + v, 0) / data.length;
                    const mouth = Math.min(1.0, avg / 40) * settings.mouthOpen;
                    const t = performance.now() * 0.001;
                    trackingRef.current.audioMouth = mouth;
                    trackingRef.current.roll = Math.sin(t * 0.7) * 0.03;
                    trackingRef.current.yaw = Math.cos(t * 0.5) * 0.04;
                    trackingRef.current.pitch = Math.sin(t * 0.3) * 0.02;
                    animRef.current = requestAnimationFrame(loop);
                };
                loop();
            } catch(e) {
                setCameraStatus('error');
            }
        })();
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [useAudio]);

    // Camera startup when user explicitly clicks the button
    useEffect(() => {
        if (cameraStatus !== 'start') return;
        setCameraStatus('loading');

        let localStream;
        (async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                streamRef.current = localStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = localStream;
                    videoRef.current.onloadeddata = () => {
                        setCameraStatus('active');
                        initMediaPipe();
                    };
                }
            } catch(e) {
                console.error('Camera error:', e);
                setCameraStatus('error');
            }
        })();

        return () => {
            if (localStream) localStream.getTracks().forEach(t => t.stop());
        };
    }, [cameraStatus]);

    const initMediaPipe = async () => {
        try {
            const { FaceLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);
            const filesetResolver = await FilesetResolver.forVisionTasks(WASM_RESOLVER_URL);
            const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL },
                runningMode: 'VIDEO',
                outputFaceBlendshapes: true,
                numFaces: 1
            });
            landmarkerRef.current = landmarker;
            setMediapipeReady(true);
            detectLoop();
        } catch(e) {
            console.warn('MediaPipe not available, camera still active without blendshapes:', e);
            // Even without MediaPipe, camera runs and we do simple rotation estimation
            detectLoopRaw();
        }
    };

    // Full MediaPipe detection loop
    const detectLoop = () => {
        const video = videoRef.current;
        const landmarker = landmarkerRef.current;
        if (!video || !landmarker) return;

        if (video.readyState >= 2) {
            const results = landmarker.detectForVideo(video, performance.now());
            if (results.faceLandmarks?.length > 0) {
                const lm = results.faceLandmarks[0];
                const bs = {};
                results.faceBlendshapes?.[0]?.categories?.forEach(c => bs[c.categoryName] = c.score);

                const pL = lm[263], pR = lm[33], pN = lm[4], pC = lm[152];
                const dx = pL.x - pR.x, dy = pL.y - pR.y;
                const rawRoll = Math.atan2(dy, dx);
                const dL = Math.hypot(pN.x - pL.x, pN.y - pL.y);
                const dR = Math.hypot(pN.x - pR.x, pN.y - pR.y);
                const rawYaw = (dL - dR) / (dL + dR) * 2.2;
                const eyeCy = (pL.y + pR.y) / 2;
                const rawPitch = ((pC.y - pN.y) - (pN.y - eyeCy)) / ((pC.y - pN.y) + (pN.y - eyeCy)) * 1.5 - 0.4;

                const a = settings.smoothing;
                const e = emaRef.current;
                e.roll   = e.roll   * a + rawRoll   * (1-a);
                e.yaw    = e.yaw    * a + rawYaw    * (1-a);
                e.pitch  = e.pitch  * a + rawPitch  * (1-a);
                e.blinkL = e.blinkL * a + (bs['eyeBlinkLeft'] || 0)  * (1-a);
                e.blinkR = e.blinkR * a + (bs['eyeBlinkRight'] || 0) * (1-a);
                e.mouth  = e.mouth  * a + (bs['jawOpen'] || 0) * (1-a);

                const t = trackingRef.current;
                t.roll = e.roll * settings.headMove;
                t.yaw  = e.yaw  * settings.headMove;
                t.pitch = e.pitch * settings.headMove;
                t.blinkL = Math.min(1, e.blinkL * settings.eyeBlink);
                t.blinkR = Math.min(1, e.blinkR * settings.eyeBlink);
                t.mouthOpen = Math.min(1.2, e.mouth * settings.mouthOpen);
                t.audioMouth = 0;

                // Draw landmarks on pip canvas
                const c = pipCanvasRef.current;
                if (c) {
                    const ctx = c.getContext('2d');
                    ctx.clearRect(0, 0, c.width, c.height);
                    ctx.fillStyle = '#10b981';
                    for (let i = 0; i < lm.length; i += 5) {
                        ctx.beginPath();
                        ctx.arc(lm[i].x * c.width, lm[i].y * c.height, 1, 0, 2*Math.PI);
                        ctx.fill();
                    }
                }
            }
        }
        animRef.current = requestAnimationFrame(detectLoop);
    };

    // Fallback raw loop (no blendshapes, very basic movement)
    const detectLoopRaw = () => {
        const t = performance.now() * 0.001;
        const tr = trackingRef.current;
        tr.roll = Math.sin(t) * 0.02;
        tr.yaw = Math.cos(t * 0.7) * 0.03;
        tr.pitch = Math.sin(t * 0.4) * 0.015;
        animRef.current = requestAnimationFrame(detectLoopRaw);
    };

    useEffect(() => () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }, []);

    return html`
        <div class="webcam-pip" style=${{ display: cameraStatus === 'active' && !useAudio ? 'block' : 'none' }}>
            <video ref=${videoRef} autoplay playsinline muted></video>
            <canvas ref=${pipCanvasRef} width="160" height="120"></canvas>
            <div class="pip-label">カメラ</div>
        </div>
    `;
}

// ========== AVATAR CANVAS (Canvas 2D, no MediaPipe dependency) ==========
function AvatarCanvas({ avatarUrl, trackingRef, settings, useAudio, activeAccessory }) {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const animRef = useRef(null);
    const emaRef = useRef({ roll:0, yaw:0, pitch:0, mouth:0, blinkL:0, blinkR:0 });
    const [imgLoaded, setImgLoaded] = useState(false);

    // Load avatar image
    useEffect(() => {
        setImgLoaded(false);
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
        };
        img.onerror = () => console.error('Failed to load avatar image:', avatarUrl);
        img.src = avatarUrl;
    }, [avatarUrl]);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imgLoaded) return;

        const render = () => {
            const ctx = canvas.getContext('2d');
            const W = canvas.width;
            const H = canvas.height;
            const img = imgRef.current;
            if (!img) { animRef.current = requestAnimationFrame(render); return; }

            ctx.clearRect(0, 0, W, H);

            // Smooth tracking data
            const tr = trackingRef.current;
            const a = settings.smoothing;
            const e = emaRef.current;

            const srcYaw   = useAudio ? tr.yaw   : (tr.yaw   || 0);
            const srcPitch = useAudio ? tr.pitch  : (tr.pitch  || 0);
            const srcRoll  = useAudio ? tr.roll   : (tr.roll   || 0);
            const srcMouth = useAudio ? tr.audioMouth : (tr.mouthOpen || 0);
            const srcBlinkL = tr.blinkL || 0;
            const srcBlinkR = tr.blinkR || 0;

            e.yaw    = e.yaw    * a + srcYaw    * (1-a);
            e.pitch  = e.pitch  * a + srcPitch  * (1-a);
            e.roll   = e.roll   * a + srcRoll   * (1-a);
            e.mouth  = e.mouth  * a + srcMouth  * (1-a);
            e.blinkL = e.blinkL * a + srcBlinkL * (1-a);
            e.blinkR = e.blinkR * a + srcBlinkR * (1-a);

            // Scale image to fit canvas maintaining aspect
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const canvasAspect = W / H;
            let drawW, drawH, drawX, drawY;
            if (imgAspect > canvasAspect) {
                drawW = W; drawH = W / imgAspect;
                drawX = 0; drawY = (H - drawH) / 2;
            } else {
                drawH = H; drawW = H * imgAspect;
                drawX = (W - drawW) / 2; drawY = 0;
            }

            // Head pivot point (center of image, slightly above vertical center)
            const pivotX = drawX + drawW * 0.5;
            const pivotY = drawY + drawH * 0.42;

            // Parallax offsets from yaw/pitch
            const offX = e.yaw   * drawW * 0.12 * settings.headMove;
            const offY = e.pitch * drawH * 0.08 * settings.headMove;

            ctx.save();
            ctx.translate(pivotX + offX, pivotY + offY);
            ctx.rotate(e.roll * 0.6 * settings.headMove);
            ctx.translate(-pivotX, -pivotY);

            // Draw base image
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();

            // Accessory overlay (emoji drawn on top)
            if (activeAccessory !== 'none') {
                const acc = { glasses:'🕶️', crown:'👑', 'cat-ears':'🐱' }[activeAccessory];
                if (acc) {
                    const faceW = drawW * 0.55;
                    const fontSize = faceW * 0.5;
                    ctx.font = `${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let ax = pivotX + offX;
                    let ay;
                    if (activeAccessory === 'crown') ay = drawY + drawH * 0.08 + offY;
                    else if (activeAccessory === 'cat-ears') ay = drawY + drawH * 0.12 + offY;
                    else ay = pivotY - drawH * 0.04 + offY; // glasses on nose bridge

                    ctx.save();
                    ctx.translate(ax, ay);
                    ctx.rotate(e.roll * 0.6 * settings.headMove);
                    ctx.fillText(acc, 0, 0);
                    ctx.restore();
                }
            }

            // Mouth open indicator overlay (semi-transparent ellipse on lower face)
            if (e.mouth > 0.05) {
                const mx = pivotX + offX;
                const my = drawY + drawH * 0.72 + offY;
                const mw = drawW * 0.12 * (1 + e.mouth * 0.5) * settings.mouthOpen;
                const mh = drawH * 0.04 * (1 + e.mouth * 2.5) * settings.mouthOpen;

                ctx.save();
                ctx.translate(mx, my);
                ctx.rotate(e.roll * 0.6 * settings.headMove);
                ctx.beginPath();
                ctx.ellipse(0, 0, mw, mh, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(20,10,10,0.7)';
                ctx.fill();
                ctx.restore();
            }

            // Blink indicators (semi-transparent overlays on eye area)
            if (e.blinkL > 0.3 || e.blinkR > 0.3) {
                // left eye area
                if (e.blinkL > 0.3) {
                    const ex = pivotX - drawW * 0.14 + offX;
                    const ey = pivotY - drawH * 0.04 + offY;
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(e.roll * 0.6 * settings.headMove);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, drawW * 0.09, drawH * 0.025 * e.blinkL * settings.eyeBlink, 0, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(var(--skin-tone, 220,180,140), ${e.blinkL * 0.9})`;
                    ctx.fill();
                    ctx.restore();
                }
                // right eye area
                if (e.blinkR > 0.3) {
                    const ex = pivotX + drawW * 0.14 + offX;
                    const ey = pivotY - drawH * 0.04 + offY;
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(e.roll * 0.6 * settings.headMove);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, drawW * 0.09, drawH * 0.025 * e.blinkR * settings.eyeBlink, 0, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(220,180,140, ${e.blinkR * 0.9})`;
                    ctx.fill();
                    ctx.restore();
                }
            }

            animRef.current = requestAnimationFrame(render);
        };

        animRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animRef.current);
    }, [imgLoaded, activeAccessory, settings, useAudio]);

    // Resize canvas to match container
    const containerRef = useRef(null);
    useEffect(() => {
        const onResize = () => {
            const c = canvasRef.current;
            const container = containerRef.current;
            if (!c || !container) return;
            c.width = container.clientWidth;
            c.height = container.clientHeight;
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return html`
        <div ref=${containerRef} style=${{ width:'100%', height:'100%', position:'absolute', top:0, left:0 }}>
            ${!imgLoaded && html`
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">画像を読み込み中...</div>
                </div>
            `}
            <canvas ref=${canvasRef} id="avatar-canvas" style=${{ width:'100%', height:'100%' }}></canvas>
        </div>
    `;
}

// ========== RECORDING ==========
function RecordingCard({ isRecording, setIsRecording, recordingTime, setRecordingTime }) {
    const recorderRef = useRef(null);
    const timerRef = useRef(null);

    const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => setRecordingTime(p => p+1), 1000);
        } else {
            clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    const start = async () => {
        const canvas = document.getElementById('avatar-canvas');
        if (!canvas) return;
        const vStream = canvas.captureStream(30);
        const combined = new MediaStream([...vStream.getVideoTracks()]);
        try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(t => combined.addTrack(t));
        } catch(e) { /* no mic, video only */ }

        const rec = new MediaRecorder(combined, { mimeType: 'video/webm' });
        const chunks = [];
        rec.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
        rec.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `vtuber-${Date.now()}.webm` });
            document.body.appendChild(a); a.click(); a.remove();
        };
        rec.start(1000);
        recorderRef.current = rec;
        setIsRecording(true);
    };

    const stop = () => {
        recorderRef.current?.stop();
        setIsRecording(false);
    };

    return html`
        <div class="panel-card">
            <h2>📹 録画・ダウンロード</h2>
            <div class="control-group">
                <p style=${{ fontSize:'12px', color:'var(--text-muted)' }}>アバター画面とマイク音声をWebMファイルで保存できます。</p>
                ${isRecording && html`
                    <div class="recording-bar">
                        <span class="recording-dot"></span>
                        <span>録画中: ${fmt(recordingTime)}</span>
                    </div>
                `}
                ${!isRecording
                    ? html`<button class="btn btn-primary" onClick=${start}>🔴 録画開始</button>`
                    : html`<button class="btn btn-danger" onClick=${stop}>⏹️ 録画停止して保存</button>`
                }
            </div>
        </div>
    `;
}

// Mount
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
