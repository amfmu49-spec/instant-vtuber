import htm from 'https://esm.sh/htm';

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback } = React;

const LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const VISION_BUNDLE_URL   = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs";
const WASM_RESOLVER_URL   = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm";

const PRESETS = [
    { id:'girl', name:'Anime Girl',   url:'presets/girl.png' },
    { id:'boy',  name:'Cyberpunk Boy',url:'presets/boy.png'  },
    { id:'cat',  name:'Cute Cat',     url:'presets/cat.png'  }
];
const BG_STYLES = [
    { id:'green',    name:'グリーンバック', bg:'#00b140' },
    { id:'studio',   name:'スタジオ',       bg:'linear-gradient(160deg,#1a1a2e,#0f3460)' },
    { id:'neon',     name:'ネオン',          bg:'linear-gradient(135deg,#0d0221,#190733,#0d0a35)' },
    { id:'gradient', name:'グラデーション', bg:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }
];
const ACCESSORIES = [
    { id:'none',      name:'なし',     emoji:'❌' },
    { id:'glasses',   name:'めがね',   emoji:'🕶️' },
    { id:'crown',     name:'クラウン', emoji:'👑' },
    { id:'cat-ears',  name:'ネコミミ', emoji:'🐱' }
];

// ───────── APP ─────────
function App() {
    const [preset, setPreset]     = useState(PRESETS[0]);
    const [uploaded, setUploaded] = useState(null);
    const [camStatus, setCamStatus] = useState('idle'); // idle|loading|active|error
    const [mpReady, setMpReady]   = useState(false);
    const [useAudio, setUseAudio] = useState(false);
    const [bgIdx, setBgIdx]       = useState(3);
    const [accessory, setAccessory] = useState('none');
    const [isRec, setIsRec]       = useState(false);
    const [recSec, setRecSec]     = useState(0);
    const [settings, setSettings] = useState({ headMove:1.0, eyeBlink:1.2, mouthOpen:1.0, smoothing:0.6 });

    // shared live tracking state — mutated by tracker, read by canvas each frame
    const trackRef = useRef({ yaw:0, pitch:0, roll:0, blinkL:0, blinkR:0, mouthOpen:0, audioMouth:0 });
    // keep a ref of settings so tracker loops always read the latest value
    const settRef  = useRef(settings);
    useEffect(() => { settRef.current = settings; }, [settings]);

    const avatarUrl = uploaded || preset.url;

    const startCamera = () => { if (camStatus === 'idle' || camStatus === 'error') setCamStatus('start'); };

    return html`
        <div class="app-container">
            <header>
                <div class="logo-section">
                    <h1>✨ Instant VTuber</h1>
                    <p>1枚の画像で誰でもバーチャル配信者に！</p>
                </div>
                <div class="status-bar">
                    <div class="status-indicator">
                        <span class="status-dot ${camStatus==='active'?'active':camStatus==='loading'?'loading':camStatus==='error'?'error':''}"></span>
                        <span style=${{fontSize:'12px'}}>
                            ${camStatus==='active' ? (mpReady?'トラッキング中 ✓':'カメラ起動中...') :
                              camStatus==='loading' ? 'カメラ接続中...' :
                              camStatus==='error'   ? 'カメラエラー' : '待機中'}
                        </span>
                    </div>
                </div>
            </header>

            <div class="workspace">
                <!-- LEFT: Canvas -->
                <div class="avatar-view" style=${{ background: BG_STYLES[bgIdx].bg }}>
                    <${AvatarCanvas} avatarUrl=${avatarUrl} trackRef=${trackRef} settRef=${settRef} useAudio=${useAudio} accessory=${accessory} />
                    <${CameraTracker} camStatus=${camStatus} setCamStatus=${setCamStatus} useAudio=${useAudio} trackRef=${trackRef} settRef=${settRef} mpReady=${mpReady} setMpReady=${setMpReady} />
                </div>

                <!-- RIGHT: Controls -->
                <div class="control-panel">
                    <!-- Character -->
                    <div class="panel-card">
                        <h2>👤 キャラクターを選ぶ</h2>
                        <div class="presets-grid">
                            ${PRESETS.map(p => html`
                                <div key=${p.id} class="preset-item ${preset.id===p.id&&!uploaded?'active':''}"
                                    onClick=${()=>{ setUploaded(null); setPreset(p); }}>
                                    <img src=${p.url} alt=${p.name} />
                                </div>
                            `)}
                        </div>
                        <${UploadZone} onImage=${url=>setUploaded(url)} />
                    </div>

                    <!-- Tracking -->
                    <div class="panel-card">
                        <h2>⚙️ トラッキング</h2>
                        <div class="control-group">
                            <div style=${{display:'flex',gap:'8px'}}>
                                <button class="btn ${!useAudio?'btn-primary':'btn-secondary'}" style=${{flex:1}} onClick=${()=>setUseAudio(false)}>📷 カメラ</button>
                                <button class="btn ${useAudio?'btn-primary':'btn-secondary'}"  style=${{flex:1}} onClick=${()=>setUseAudio(true)}>🎤 マイク</button>
                            </div>

                            ${!useAudio && (camStatus==='idle'||camStatus==='error') && html`
                                <button class="btn btn-primary" onClick=${startCamera}>
                                    📷 カメラを起動する
                                </button>
                            `}
                            ${!useAudio && camStatus==='loading' && html`
                                <div style=${{fontSize:'12px',color:'var(--text-muted)',textAlign:'center',padding:'8px'}}>
                                    <div class="spinner" style=${{width:'24px',height:'24px',margin:'0 auto 6px'}}></div>
                                    カメラとAIモデルを読み込み中...
                                </div>
                            `}
                            ${!useAudio && camStatus==='error' && html`
                                <div style=${{fontSize:'12px',color:'#ef4444',padding:'8px',background:'rgba(239,68,68,0.1)',borderRadius:'8px',lineHeight:1.7}}>
                                    ⚠️ カメラが使えませんでした。<br/>
                                    ブラウザの設定でカメラ許可を「許可」にして再度お試しください。
                                </div>
                            `}
                            ${!useAudio && camStatus==='active' && html`
                                <div style=${{fontSize:'12px',color:'#10b981',padding:'6px 10px',background:'rgba(16,185,129,0.1)',borderRadius:'8px'}}>
                                    ${mpReady ? '✅ 顔トラッキング ON！動いて試してみてください。' : '⏳ AIモデルをダウンロード中... しばらくお待ちください。'}
                                </div>
                            `}

                            ${[
                                {key:'headMove',  label:'頭の動き',  min:0.2, max:2.0, step:0.1},
                                {key:'eyeBlink',  label:'まばたき',  min:0.5, max:2.0, step:0.1},
                                {key:'mouthOpen', label:'口の開き',  min:0.5, max:2.0, step:0.1},
                                {key:'smoothing', label:'スムージング', min:0.05, max:0.9, step:0.05}
                            ].map(({key,label,min,max,step}) => html`
                                <div class="slider-container" key=${key}>
                                    <div class="slider-label">
                                        <span>${label}</span>
                                        <span class="slider-value">${settings[key].toFixed(key==='smoothing'?2:1)}</span>
                                    </div>
                                    <input type="range" min=${min} max=${max} step=${step} value=${settings[key]}
                                        onChange=${e=>setSettings(p=>({...p,[key]:+e.target.value}))} />
                                </div>
                            `)}
                        </div>
                    </div>

                    <!-- Background & Accessories -->
                    <div class="panel-card">
                        <h2>🎨 背景 & アクセサリー</h2>
                        <div class="control-group">
                            <div class="slider-label"><span>背景</span></div>
                            <div class="bg-options">
                                ${BG_STYLES.map((bg,i) => html`
                                    <button key=${bg.id} class="bg-option-btn ${bgIdx===i?'active':''}"
                                        style=${{background:bg.bg}} onClick=${()=>setBgIdx(i)}>
                                        <span>${bg.name}</span>
                                    </button>
                                `)}
                            </div>
                            <div class="slider-label" style=${{marginTop:'10px'}}><span>アクセサリー</span></div>
                            <div class="accessory-options">
                                ${ACCESSORIES.map(a => html`
                                    <button key=${a.id} class="accessory-btn ${accessory===a.id?'active':''}" onClick=${()=>setAccessory(a.id)}>
                                        <span class="accessory-btn-icon">${a.emoji}</span>
                                        <span>${a.name}</span>
                                    </button>
                                `)}
                            </div>
                        </div>
                    </div>

                    <${RecordingCard} isRec=${isRec} setIsRec=${setIsRec} recSec=${recSec} setRecSec=${setRecSec} />
                </div>
            </div>
        </div>
    `;
}

// ───────── UPLOAD ZONE ─────────
function UploadZone({ onImage }) {
    const [drag, setDrag] = useState(false);
    const ref = useRef(null);
    const process = f => { if(!f||!f.type.startsWith('image/')) return; const r=new FileReader(); r.onload=e=>onImage(e.target.result); r.readAsDataURL(f); };
    return html`
        <div class="upload-zone ${drag?'drag-active':''}"
            onDragEnter=${e=>{e.preventDefault();setDrag(true);}}
            onDragOver=${e=>{e.preventDefault();setDrag(true);}}
            onDragLeave=${e=>{e.preventDefault();setDrag(false);}}
            onDrop=${e=>{e.preventDefault();setDrag(false);process(e.dataTransfer.files[0]);}}
            onClick=${()=>ref.current.click()}>
            <input ref=${ref} type="file" accept="image/*" style=${{display:'none'}} onChange=${e=>process(e.target.files[0])} />
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style=${{marginBottom:'8px',color:'var(--text-muted)'}}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4-4 4 4 4-8 4 4M4 20h16" />
            </svg>
            <p>自分の画像をアップロード</p>
            <span>クリック / ドラッグ＆ドロップ</span>
        </div>
    `;
}

// ───────── CAMERA TRACKER ─────────
// All camera / audio state is managed in one place.
// trackRef is mutated directly each frame so AvatarCanvas always reads latest data.
function CameraTracker({ camStatus, setCamStatus, useAudio, trackRef, settRef, mpReady, setMpReady }) {
    const videoRef     = useRef(null);
    const pipCanvasRef = useRef(null);
    const rafRef       = useRef(null);
    const streamRef    = useRef(null);
    const landmarkerRef= useRef(null);
    const emaRef       = useRef({ roll:0, yaw:0, pitch:0, blinkL:0, blinkR:0, mouth:0 });
    const audioRefs    = useRef({ ctx:null, analyser:null, stream:null });

    // Stop everything on unmount
    useEffect(() => () => {
        stopAll();
    }, []);

    const stopAll = () => {
        if (rafRef.current)      cancelAnimationFrame(rafRef.current);
        if (streamRef.current)   streamRef.current.getTracks().forEach(t=>t.stop());
        if (audioRefs.current.ctx) audioRefs.current.ctx.close();
        if (audioRefs.current.stream) audioRefs.current.stream.getTracks().forEach(t=>t.stop());
    };

    // ── Audio mode ──
    useEffect(() => {
        if (!useAudio) return;
        let mounted = true;
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return; }
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                ctx.createMediaStreamSource(stream).connect(analyser);
                audioRefs.current = { ctx, analyser, stream };
                setCamStatus('active');

                const loop = () => {
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(data);
                    const avg = data.reduce((s,v)=>s+v, 0) / data.length;
                    const s   = settRef.current;
                    const now = performance.now() * 0.001;
                    trackRef.current.audioMouth = Math.min(1, avg / 40) * s.mouthOpen;
                    trackRef.current.roll  = Math.sin(now * 0.7) * 0.03;
                    trackRef.current.yaw   = Math.cos(now * 0.5) * 0.04;
                    trackRef.current.pitch = Math.sin(now * 0.3) * 0.02;
                    if (mounted) rafRef.current = requestAnimationFrame(loop);
                };
                loop();
            } catch(e) {
                if (mounted) setCamStatus('error');
            }
        })();
        return () => {
            mounted = false;
            cancelAnimationFrame(rafRef.current);
            const { ctx, stream } = audioRefs.current;
            if (ctx)    ctx.close();
            if (stream) stream.getTracks().forEach(t=>t.stop());
        };
    }, [useAudio]);

    // ── Camera startup ──
    useEffect(() => {
        if (camStatus !== 'start') return;
        let mounted = true;
        setCamStatus('loading');

        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} }
                });
                if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return; }
                streamRef.current = stream;

                const vid = videoRef.current;
                vid.srcObject = stream;
                await vid.play();
                setCamStatus('active');

                // Try to load MediaPipe (may take a while on mobile)
                loadMediaPipe(vid, mounted);
            } catch(err) {
                console.error('Camera error:', err);
                if (mounted) setCamStatus('error');
            }
        })();

        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camStatus]);

    const loadMediaPipe = async (vid, mounted) => {
        try {
            const { FaceLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);
            const resolver = await FilesetResolver.forVisionTasks(WASM_RESOLVER_URL);
            const lm = await FaceLandmarker.createFromOptions(resolver, {
                baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL },
                runningMode: 'VIDEO',
                outputFaceBlendshapes: true,
                numFaces: 1
            });
            if (!mounted) { lm.close(); return; }
            landmarkerRef.current = lm;
            setMpReady(true);

            // Cancel any previous loop and start face tracking loop
            cancelAnimationFrame(rafRef.current);
            faceLoop(vid);
        } catch(e) {
            console.warn('MediaPipe failed, using raw head movement:', e);
            if (mounted) {
                cancelAnimationFrame(rafRef.current);
                rawLoop(vid);
            }
        }
    };

    // Full MediaPipe tracking loop
    const faceLoop = (vid) => {
        const lm = landmarkerRef.current;
        if (!lm || !vid) return;

        const detect = () => {
            if (vid.readyState >= 2) {
                const res = lm.detectForVideo(vid, performance.now());
                if (res.faceLandmarks?.length > 0) {
                    const pts = res.faceLandmarks[0];
                    const bs  = {};
                    res.faceBlendshapes?.[0]?.categories?.forEach(c => bs[c.categoryName] = c.score);

                    const pL = pts[263], pR = pts[33], pN = pts[4], pC = pts[152];
                    const rawRoll  = Math.atan2(pL.y - pR.y, pL.x - pR.x);
                    const dL = Math.hypot(pN.x-pL.x, pN.y-pL.y), dR = Math.hypot(pN.x-pR.x, pN.y-pR.y);
                    const rawYaw   = (dL - dR) / (dL + dR) * 2.2;
                    const eyeCy    = (pL.y + pR.y) / 2;
                    const rawPitch = ((pC.y-pN.y) - (pN.y-eyeCy)) / ((pC.y-pN.y) + (pN.y-eyeCy)) * 1.5 - 0.4;

                    const s = settRef.current;
                    const a = s.smoothing;
                    const e = emaRef.current;
                    e.roll   = e.roll   * a + rawRoll  * (1-a);
                    e.yaw    = e.yaw    * a + rawYaw   * (1-a);
                    e.pitch  = e.pitch  * a + rawPitch * (1-a);
                    e.blinkL = e.blinkL * a + (bs['eyeBlinkLeft']  || 0) * (1-a);
                    e.blinkR = e.blinkR * a + (bs['eyeBlinkRight'] || 0) * (1-a);
                    e.mouth  = e.mouth  * a + (bs['jawOpen']       || 0) * (1-a);

                    const tr = trackRef.current;
                    tr.yaw      = e.yaw   * s.headMove;
                    tr.pitch    = e.pitch * s.headMove;
                    tr.roll     = e.roll  * s.headMove;
                    tr.blinkL   = Math.min(1,   e.blinkL * s.eyeBlink);
                    tr.blinkR   = Math.min(1,   e.blinkR * s.eyeBlink);
                    tr.mouthOpen= Math.min(1.2, e.mouth  * s.mouthOpen);
                    tr.audioMouth = 0;

                    // pip overlay
                    const c = pipCanvasRef.current;
                    if (c) {
                        const ctx2 = c.getContext('2d');
                        ctx2.clearRect(0,0,c.width,c.height);
                        ctx2.fillStyle = '#10b981';
                        for (let i=0; i<pts.length; i+=5) {
                            ctx2.beginPath();
                            ctx2.arc(pts[i].x*c.width, pts[i].y*c.height, 1, 0, Math.PI*2);
                            ctx2.fill();
                        }
                    }
                }
            }
            rafRef.current = requestAnimationFrame(detect);
        };
        detect();
    };

    // Fallback loop when MediaPipe isn't available: use pixel difference to detect movement
    const rawLoop = (vid) => {
        let prevData = null;
        const offscreen = document.createElement('canvas');
        offscreen.width = 32; offscreen.height = 32;
        const offCtx = offscreen.getContext('2d');

        const detect = () => {
            if (vid.readyState >= 2) {
                offCtx.drawImage(vid, 0, 0, 32, 32);
                const cur = offCtx.getImageData(0, 0, 32, 32).data;

                if (prevData) {
                    let diffX = 0, diffY = 0, diffTotal = 0;
                    for (let y = 0; y < 32; y++) {
                        for (let x = 0; x < 32; x++) {
                            const i = (y * 32 + x) * 4;
                            const d = Math.abs(cur[i] - prevData[i]) + Math.abs(cur[i+1] - prevData[i+1]) + Math.abs(cur[i+2] - prevData[i+2]);
                            diffX += d * (x - 16);
                            diffY += d * (y - 16);
                            diffTotal += d;
                        }
                    }
                    if (diffTotal > 100) {
                        const s = settRef.current;
                        const a = s.smoothing;
                        const e = emaRef.current;
                        const nx = (diffX / diffTotal) / 16;
                        const ny = (diffY / diffTotal) / 16;
                        e.yaw   = e.yaw   * a + nx * (1-a) * 0.4;
                        e.pitch = e.pitch * a + ny * (1-a) * 0.3;
                        const tr = trackRef.current;
                        tr.yaw   = e.yaw   * s.headMove;
                        tr.pitch = e.pitch * s.headMove;
                        tr.roll  = 0;
                        tr.mouthOpen = 0;
                        tr.audioMouth = 0;
                    }
                }
                prevData = new Uint8ClampedArray(cur);
            }
            rafRef.current = requestAnimationFrame(detect);
        };
        detect();
    };

    return html`
        <div class="webcam-pip" style=${{ display: camStatus==='active' && !useAudio ? 'block' : 'none' }}>
            <video ref=${videoRef} playsinline muted></video>
            <canvas ref=${pipCanvasRef} width="160" height="120"></canvas>
            <div class="pip-label">カメラ ${mpReady ? '🟢 AI ON' : '🟡 読み込み中...'}</div>
        </div>
    `;
}

// ───────── AVATAR CANVAS ─────────
function AvatarCanvas({ avatarUrl, trackRef, settRef, useAudio, accessory }) {
    const canvasRef    = useRef(null);
    const containerRef = useRef(null);
    const imgRef       = useRef(null);
    const rafRef       = useRef(null);
    const emaRef       = useRef({ yaw:0, pitch:0, roll:0, mouth:0, blinkL:0, blinkR:0 });
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false);
        const img = new Image();
        img.onload  = () => { imgRef.current = img; setLoaded(true); };
        img.onerror = () => console.error('Image load failed:', avatarUrl);
        img.src = avatarUrl;
    }, [avatarUrl]);

    useEffect(() => {
        const onResize = () => {
            const c = canvasRef.current, cont = containerRef.current;
            if (!c || !cont) return;
            c.width  = cont.clientWidth;
            c.height = cont.clientHeight;
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !loaded) return;

        const frame = () => {
            const ctx  = canvas.getContext('2d');
            const W    = canvas.width, H = canvas.height;
            const img  = imgRef.current;
            if (!img || W === 0 || H === 0) { rafRef.current = requestAnimationFrame(frame); return; }

            ctx.clearRect(0, 0, W, H);

            // Read live tracking
            const tr = trackRef.current;
            const s  = settRef.current;

            // Apply smoothing to canvas-side EMA as well (for silky rendering)
            const a = Math.min(0.95, s.smoothing);
            const e = emaRef.current;
            const rawYaw   = useAudio ? (tr.yaw   || 0) : (tr.yaw   || 0);
            const rawPitch = useAudio ? (tr.pitch || 0) : (tr.pitch || 0);
            const rawRoll  = useAudio ? (tr.roll  || 0) : (tr.roll  || 0);
            const rawMouth = useAudio ? tr.audioMouth : (tr.mouthOpen || 0);
            e.yaw    = e.yaw    * a + rawYaw    * (1-a);
            e.pitch  = e.pitch  * a + rawPitch  * (1-a);
            e.roll   = e.roll   * a + rawRoll   * (1-a);
            e.mouth  = e.mouth  * a + rawMouth  * (1-a);
            e.blinkL = e.blinkL * a + (tr.blinkL || 0) * (1-a);
            e.blinkR = e.blinkR * a + (tr.blinkR || 0) * (1-a);

            // Fit image
            const imgAsp = img.naturalWidth / img.naturalHeight;
            const canAsp = W / H;
            let iW, iH, iX, iY;
            if (imgAsp > canAsp) { iW=W; iH=W/imgAsp; iX=0; iY=(H-iH)/2; }
            else                  { iH=H; iW=H*imgAsp; iX=(W-iW)/2; iY=0; }

            const pivotX = iX + iW * 0.5;
            const pivotY = iY + iH * 0.42;

            // Parallax offsets (head translation)
            const offX = e.yaw   * iW * 0.10;
            const offY = e.pitch * iH * 0.07;
            const rollRad = e.roll * 0.5;

            ctx.save();
            ctx.translate(pivotX + offX, pivotY + offY);
            ctx.rotate(rollRad);
            ctx.translate(-pivotX, -pivotY);
            ctx.drawImage(img, iX, iY, iW, iH);
            ctx.restore();

            // ── Mouth overlay ──
            const mouthAmt = Math.max(0, e.mouth - 0.05);
            if (mouthAmt > 0) {
                const mx  = pivotX + offX;
                const my  = iY + iH * 0.72 + offY;
                const mWx = iW * 0.10 * (1 + mouthAmt * 0.3);
                const mHx = iH * 0.025 * (1 + mouthAmt * 3.5);
                ctx.save();
                ctx.translate(mx, my); ctx.rotate(rollRad);
                ctx.beginPath(); ctx.ellipse(0, 0, mWx, mHx, 0, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(15,5,5,0.75)'; ctx.fill();
                ctx.restore();
            }

            // ── Blink overlays ──
            [[e.blinkL, -0.14], [e.blinkR, 0.14]].forEach(([blink, xOff]) => {
                if (blink < 0.25) return;
                const ex = pivotX + iW * xOff + offX;
                const ey = pivotY - iH * 0.03 + offY;
                const eW = iW * 0.09;
                const eH = iH * 0.015 * blink * 2.5;
                ctx.save();
                ctx.translate(ex, ey); ctx.rotate(rollRad);
                ctx.beginPath(); ctx.ellipse(0, 0, eW, eH, 0, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(210,170,130,0.88)'; ctx.fill();
                ctx.restore();
            });

            // ── Accessory ──
            if (accessory !== 'none') {
                const emojiMap = { glasses:'🕶️', crown:'👑', 'cat-ears':'🐱' };
                const emoji = emojiMap[accessory];
                const fs = iW * 0.25;
                let ax = pivotX + offX;
                let ay = accessory==='glasses' ? (pivotY - iH*0.04 + offY)
                       : accessory==='crown'   ? (iY + iH*0.06 + offY)
                       :                         (iY + iH*0.08 + offY);
                ctx.save();
                ctx.font = `${fs}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.translate(ax, ay); ctx.rotate(rollRad);
                ctx.fillText(emoji, 0, 0);
                ctx.restore();
            }

            rafRef.current = requestAnimationFrame(frame);
        };

        rafRef.current = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(rafRef.current);
    }, [loaded, accessory, useAudio]);

    return html`
        <div ref=${containerRef} style=${{width:'100%',height:'100%',position:'absolute',top:0,left:0}}>
            ${!loaded && html`
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">画像を読み込み中...</div>
                </div>
            `}
            <canvas ref=${canvasRef} id="avatar-canvas" style=${{width:'100%',height:'100%'}}></canvas>
        </div>
    `;
}

// ───────── RECORDING ─────────
function RecordingCard({ isRec, setIsRec, recSec, setRecSec }) {
    const recRef = useRef(null);
    const timerRef = useRef(null);
    const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

    useEffect(() => {
        if (isRec) { timerRef.current = setInterval(()=>setRecSec(p=>p+1),1000); }
        else        { clearInterval(timerRef.current); setRecSec(0); }
        return () => clearInterval(timerRef.current);
    }, [isRec]);

    const start = async () => {
        const canvas = document.getElementById('avatar-canvas');
        if (!canvas) return;
        const vStream  = canvas.captureStream(30);
        const combined = new MediaStream([...vStream.getVideoTracks()]);
        try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(t => combined.addTrack(t));
        } catch(_) {}
        const rec = new MediaRecorder(combined);
        const chunks = [];
        rec.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
        rec.onstop = () => {
            const blob = new Blob(chunks, { type:'video/webm' });
            const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`vtuber-${Date.now()}.webm` });
            document.body.appendChild(a); a.click(); a.remove();
        };
        rec.start(1000);
        recRef.current = rec;
        setIsRec(true);
    };

    return html`
        <div class="panel-card">
            <h2>📹 録画・ダウンロード</h2>
            <div class="control-group">
                <p style=${{fontSize:'12px',color:'var(--text-muted)'}}>アバター画面とマイク音声をWebMファイルで保存できます。</p>
                ${isRec && html`<div class="recording-bar"><span class="recording-dot"></span><span>録画中: ${fmt(recSec)}</span></div>`}
                ${!isRec
                    ? html`<button class="btn btn-primary" onClick=${start}>🔴 録画開始</button>`
                    : html`<button class="btn btn-danger" onClick=${()=>{ recRef.current?.stop(); setIsRec(false); }}>⏹️ 録画停止して保存</button>`}
            </div>
        </div>
    `;
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
