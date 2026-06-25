import htm from 'https://esm.sh/htm';

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback } = React;

const PRESETS = [
    { id:'girl', name:'Anime Girl',    url:'presets/girl.png' },
    { id:'boy',  name:'Cyberpunk Boy', url:'presets/boy.png'  },
    { id:'cat',  name:'Cute Cat',      url:'presets/cat.png'  }
];
const BG_STYLES = [
    { id:'green',  name:'グリーン',  bg:'#00b140' },
    { id:'studio', name:'スタジオ',  bg:'linear-gradient(160deg,#1a1a2e,#0f3460)' },
    { id:'neon',   name:'ネオン',    bg:'linear-gradient(135deg,#0d0221,#190733)' },
    { id:'grad',   name:'グラデ',    bg:'linear-gradient(135deg,#1a1a2e,#0f3460)' }
];
const ACCS = [
    { id:'none',    name:'なし',     emoji:'❌' },
    { id:'glasses', name:'めがね',   emoji:'🕶️' },
    { id:'crown',   name:'王冠',     emoji:'👑' },
    { id:'ears',    name:'ネコミミ', emoji:'🐱' }
];
const MP_BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs';
const MP_WASM   = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';
const MP_MODEL  = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Face mesh connection groups for wireframe rendering
const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
const LEFT_EYE  = [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466,263];
const RIGHT_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33];
const LIPS_OUTER= [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61];
const NOSE_RIDGE= [168,6,197,195,5,4];
const MESH_GROUPS = [
    {pts: FACE_OVAL, color: 'rgba(16,185,129,0.45)'},
    {pts: LEFT_EYE,  color: 'rgba(96,165,250,0.7)'},
    {pts: RIGHT_EYE, color: 'rgba(96,165,250,0.7)'},
    {pts: LIPS_OUTER,color: 'rgba(248,113,113,0.8)'},
    {pts: NOSE_RIDGE,color: 'rgba(250,204,21,0.6)'}
];

// ── Character face analysis helper ──
// Runs MediaPipe IMAGE mode and returns normalized face feature positions
async function analyzeCharFace(imageUrl) {
    try {
        const img = new Image();
        img.src = imageUrl;
        await new Promise((res,rej) => { img.onload=res; img.onerror=rej; setTimeout(rej,8000); });

        const { FaceLandmarker, FilesetResolver } = await import(MP_BUNDLE);
        const vfs = await FilesetResolver.forVisionTasks(MP_WASM);
        const lm = await FaceLandmarker.createFromOptions(vfs, {
            baseOptions: { modelAssetPath: MP_MODEL },
            runningMode: 'IMAGE', numFaces: 1
        });
        const results = lm.detect(img);
        lm.close();

        if (!results.faceLandmarks?.length) return null;
        const p = results.faceLandmarks[0];

        const avg = (indices) => ({
            x: indices.reduce((s,i)=>s+p[i].x,0)/indices.length,
            y: indices.reduce((s,i)=>s+p[i].y,0)/indices.length
        });

        const lEye   = avg([362,385,387,263,373,380]);
        const rEye   = avg([33,160,158,133,153,144]);
        const mouthL = p[61], mouthR = p[291];
        const mouthT = p[13], mouthB = p[14];
        const mouthCx = (mouthL.x + mouthR.x) / 2;
        const mouthCy = (mouthT.y + mouthB.y) / 2;
        const mouthW  = Math.abs(mouthR.x - mouthL.x);

        console.log('✅ Character face analysis done:', { lEye, rEye, mouthCx, mouthCy, mouthW });
        return { lEye, rEye, mouthCx, mouthCy, mouthW, noseTip: p[4] };
    } catch(e) {
        console.warn('Character face analysis failed:', e);
        return null;
    }
}

// ══════════════════════════════════════════
//  APP
// ══════════════════════════════════════════
function App() {
    const [preset, setPreset] = useState(PRESETS[0]);
    const [photo,  setPhoto]  = useState(null);
    const [bgIdx,  setBgIdx]  = useState(3);
    const [acc,    setAcc]    = useState('none');
    const [useAudio, setUseAudio] = useState(false);
    const [camState, setCamState] = useState('idle');
    const [aiState,  setAiState]  = useState('none');
    const [isRec,  setIsRec]  = useState(false);
    const [recSec, setRecSec] = useState(0);
    const [sens,   setSens]   = useState({ head:1.0, blink:1.2, mouth:1.0, smooth:0.6 });
    const [showMenu, setShowMenu] = useState(false);
    const [offsets, setOffsets] = useState({
        eyeSpacing: 0,
        eyeY: 0,
        eyeScale: 1.0,
        mouthX: 0,
        mouthY: 0,
        mouthScale: 1.0
    });

    // Refs
    const videoRef      = useRef(null);   // <video> — always in DOM, never visible
    const pipCanvasRef  = useRef(null);   // <canvas> in PiP — shows only mesh
    const streamRef     = useRef(null);
    const rafRef        = useRef(null);
    const lmRef         = useRef(null);
    const trackRef      = useRef({ yaw:0, pitch:0, roll:0, blinkL:0, blinkR:0, mouthOpen:0, audioMouth:0 });
    const sensRef       = useRef(sens);
    const emaRef        = useRef({ roll:0, yaw:0, pitch:0, bL:0, bR:0, mo:0 });
    const audioRef      = useRef({ ctx:null, analyser:null, stream:null });
    const charFaceRef   = useRef(null);   // detected face positions in the character image
    const analyzingRef  = useRef(false);

    useEffect(() => { sensRef.current = sens; }, [sens]);

    useEffect(() => () => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t=>t.stop());
        audioRef.current.ctx?.close();
        audioRef.current.stream?.getTracks().forEach(t=>t.stop());
    }, []);

    // ── Analyze character face whenever avatar URL changes ──
    const avatarUrl = photo || preset.url;
    useEffect(() => {
        charFaceRef.current = null; // Reset while analyzing
        analyzingRef.current = true;
        analyzeCharFace(avatarUrl).then(result => {
            charFaceRef.current = result;
            analyzingRef.current = false;
        });
    }, [avatarUrl]);

    // ── Start camera ──
    const startCamera = useCallback(async () => {
        if (camState === 'loading' || camState === 'active') return;
        setCamState('loading');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} }
            });
            streamRef.current = stream;
            const vid = videoRef.current;
            vid.srcObject = stream;
            await new Promise(resolve => {
                if (vid.readyState >= 1) { resolve(); return; }
                vid.onloadedmetadata = resolve;
                setTimeout(resolve, 3000);
            });
            vid.play().catch(()=>{});
            setCamState('active');
            loadMediaPipe();
        } catch(err) {
            console.error('Camera error:', err);
            setCamState('error');
        }
    }, [camState]);

    // ── Load MediaPipe (video mode for tracking) ──
    const loadMediaPipe = async () => {
        setAiState('loading');
        try {
            const { FaceLandmarker, FilesetResolver } = await import(MP_BUNDLE);
            const vfs = await FilesetResolver.forVisionTasks(MP_WASM);
            const lm  = await FaceLandmarker.createFromOptions(vfs, {
                baseOptions: { modelAssetPath: MP_MODEL },
                runningMode: 'VIDEO',
                outputFaceBlendshapes: true,
                numFaces: 1
            });
            lmRef.current = lm;
            setAiState('ready');
            cancelAnimationFrame(rafRef.current);
            runFaceLoop();

            // Also run character analysis now that WASM is cached
            if (!charFaceRef.current && !analyzingRef.current) {
                analyzeCharFace(avatarUrl).then(r => { charFaceRef.current = r; });
            }
        } catch(e) {
            console.warn('MediaPipe failed, pixel-diff fallback:', e);
            setAiState('fail');
            cancelAnimationFrame(rafRef.current);
            runPixelLoop();
        }
    };

    // ── MediaPipe face tracking loop ──
    const runFaceLoop = () => {
        const vid = videoRef.current, lm = lmRef.current;
        if (!vid || !lm) return;

        const loop = () => {
            if (vid.readyState >= 2) {
                const res = lm.detectForVideo(vid, performance.now());
                if (res.faceLandmarks?.length > 0) {
                    const pts = res.faceLandmarks[0];
                    const bs  = {};
                    res.faceBlendshapes?.[0]?.categories?.forEach(c => bs[c.categoryName] = c.score);

                    // Head pose
                    const pL = pts[263], pR = pts[33], pN = pts[4], pC = pts[152];
                    const rawRoll  = -Math.atan2(pL.y-pR.y, pL.x-pR.x);
                    const dL = Math.hypot(pN.x-pL.x, pN.y-pL.y);
                    const dR = Math.hypot(pN.x-pR.x, pN.y-pR.y);
                    const rawYaw   = (dL - dR) / (dL + dR) * 2.2; // negative removed for mirror fix
                    const eyeCy    = (pL.y + pR.y) / 2;
                    const rawPitch = ((pC.y-pN.y) - (pN.y-eyeCy)) / ((pC.y-pN.y) + (pN.y-eyeCy)) * 1.5 - 0.4;

                    const s=sensRef.current, a=s.smooth, e=emaRef.current;
                    e.roll  = e.roll  * a + rawRoll  * (1-a);
                    e.yaw   = e.yaw   * a + rawYaw   * (1-a);
                    e.pitch = e.pitch * a + rawPitch * (1-a);
                    e.bL    = e.bL    * a + (bs['eyeBlinkLeft']  || 0) * (1-a);
                    e.bR    = e.bR    * a + (bs['eyeBlinkRight'] || 0) * (1-a);
                    e.mo    = e.mo    * a + (bs['jawOpen']       || 0) * (1-a);

                    const tr = trackRef.current;
                    tr.yaw       = e.yaw   * s.head;
                    tr.pitch     = e.pitch * s.head;
                    tr.roll      = e.roll  * s.head;
                    tr.blinkL    = Math.min(1,   e.bL * s.blink);
                    tr.blinkR    = Math.min(1,   e.bR * s.blink);
                    tr.mouthOpen = Math.min(1.2, e.mo  * s.mouth);
                    tr.audioMouth = 0;

                    // ── Draw wireframe mesh on PiP canvas ──
                    const pc = pipCanvasRef.current;
                    if (pc) {
                        const W = pc.width, H = pc.height;
                        const ctx2 = pc.getContext('2d');
                        ctx2.fillStyle = '#060a10';
                        ctx2.fillRect(0, 0, W, H);

                        // Draw connection groups
                        MESH_GROUPS.forEach(({pts:grp, color}) => {
                            ctx2.beginPath();
                            ctx2.strokeStyle = color;
                            ctx2.lineWidth = 0.8;
                            ctx2.moveTo(pts[grp[0]].x * W, pts[grp[0]].y * H);
                            for (let i = 1; i < grp.length; i++) {
                                ctx2.lineTo(pts[grp[i]].x * W, pts[grp[i]].y * H);
                            }
                            ctx2.stroke();
                        });

                        // Landmark dots
                        ctx2.fillStyle = 'rgba(16,185,129,0.8)';
                        for (let i = 0; i < pts.length; i += 6) {
                            ctx2.beginPath();
                            ctx2.arc(pts[i].x * W, pts[i].y * H, 1.2, 0, Math.PI*2);
                            ctx2.fill();
                        }

                        // Highlight mouth in red
                        ctx2.fillStyle = 'rgba(248,113,113,0.9)';
                        [61,291,13,14,0,17].forEach(idx => {
                            ctx2.beginPath();
                            ctx2.arc(pts[idx].x * W, pts[idx].y * H, 2, 0, Math.PI*2);
                            ctx2.fill();
                        });

                        // Highlight eyes in blue
                        ctx2.fillStyle = 'rgba(96,165,250,0.9)';
                        [362,263,33,133].forEach(idx => {
                            ctx2.beginPath();
                            ctx2.arc(pts[idx].x * W, pts[idx].y * H, 2, 0, Math.PI*2);
                            ctx2.fill();
                        });
                    }
                } else {
                    // No face detected — draw dark canvas
                    const pc = pipCanvasRef.current;
                    if (pc) {
                        const ctx2 = pc.getContext('2d');
                        ctx2.fillStyle = '#060a10';
                        ctx2.fillRect(0, 0, pc.width, pc.height);
                        ctx2.fillStyle = 'rgba(255,255,255,0.2)';
                        ctx2.font = '9px Arial'; ctx2.textAlign = 'center';
                        ctx2.fillText('顔を映してください', pc.width/2, pc.height/2);
                    }
                }
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
    };

    // ── Pixel-diff fallback ──
    const runPixelLoop = () => {
        const vid = videoRef.current; if (!vid) return;
        const off = document.createElement('canvas'); off.width=32; off.height=32;
        const oc = off.getContext('2d');
        let prev = null;
        const loop = () => {
            if (vid.readyState >= 2) {
                oc.drawImage(vid, 0, 0, 32, 32);
                const cur = oc.getImageData(0,0,32,32).data;
                if (prev) {
                    let sx=0, sy=0, tot=0;
                    for (let y=0; y<32; y++) for (let x=0; x<32; x++) {
                        const i=(y*32+x)*4;
                        const d=Math.abs(cur[i]-prev[i])+Math.abs(cur[i+1]-prev[i+1])+Math.abs(cur[i+2]-prev[i+2]);
                        sx+=d*(x-16); sy+=d*(y-16); tot+=d;
                    }
                    if (tot>200) {
                        const s=sensRef.current, a=s.smooth, e=emaRef.current;
                        e.yaw   = e.yaw   * a - (sx/tot/16) * (1-a) * 0.5;
                        e.pitch = e.pitch * a + (sy/tot/16) * (1-a) * 0.4;
                        const tr = trackRef.current;
                        tr.yaw=e.yaw*s.head; tr.pitch=e.pitch*s.head;
                    }
                }
                prev = new Uint8ClampedArray(cur);
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
    };

    // ── Audio mode ──
    const startAudio = useCallback(async () => {
        cancelAnimationFrame(rafRef.current);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            const ctx = new (window.AudioContext||window.webkitAudioContext)();
            const an  = ctx.createAnalyser(); an.fftSize=256;
            ctx.createMediaStreamSource(stream).connect(an);
            audioRef.current = {ctx, analyser:an, stream};
            setCamState('active');
            const run = () => {
                const data = new Uint8Array(an.frequencyBinCount);
                an.getByteFrequencyData(data);
                const avg = data.reduce((s,v)=>s+v,0)/data.length;
                const s = sensRef.current, now = performance.now()*0.001;
                trackRef.current.audioMouth = Math.min(1, avg/40)*s.mouth;
                trackRef.current.roll  = Math.sin(now*0.7)*0.03;
                trackRef.current.yaw   = Math.cos(now*0.5)*0.04;
                trackRef.current.pitch = Math.sin(now*0.3)*0.02;
                rafRef.current = requestAnimationFrame(run);
            };
            run();
        } catch(e) { setCamState('error'); }
    }, []);

    const handleModeChange = (audio) => {
        cancelAnimationFrame(rafRef.current);
        if (!audio) {
            audioRef.current.ctx?.close();
            audioRef.current.stream?.getTracks().forEach(t=>t.stop());
            audioRef.current = {ctx:null,analyser:null,stream:null};
        } else {
            streamRef.current?.getTracks().forEach(t=>t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
        }
        setCamState('idle'); setAiState('none'); setUseAudio(audio);
    };

    useEffect(() => { if (useAudio) startAudio(); }, [useAudio]);

    return html`
        <div class="app-container">
            <!-- Floating Menu Toggle Button -->
            <button class="floating-menu-btn" onClick=${()=>setShowMenu(!showMenu)}>
                ⚙️
            </button>

            <!-- Minimal camera status indicator in top-left -->
            <div class="floating-status">
                <span class="status-dot ${camState==='active'?'active':camState==='loading'?'loading':camState==='error'?'error':''}"></span>
                <span style=${{fontSize:'10px', fontWeight:600}}>
                    ${camState==='active' ? (aiState==='ready'?'🟢トラッキング中':aiState==='loading'?'⏳読込中...':'簡易モード') : ''}
                </span>
            </div>

            <div class="workspace full-screen">
                <!-- LEFT / MAIN VIEW -->
                <div class="avatar-view full-viewport" style=${{ background: BG_STYLES[bgIdx].bg }}>
                    <${AvatarCanvas}
                        url=${avatarUrl}
                        trackRef=${trackRef}
                        sensRef=${sensRef}
                        useAudio=${useAudio}
                        acc=${acc}
                        charFaceRef=${charFaceRef}
                        offsets=${offsets}
                    />

                    <video ref=${videoRef} playsinline muted
                        style=${{position:'absolute',opacity:0,pointerEvents:'none',width:'1px',height:'1px',top:'-9999px',left:'-9999px'}}>
                    </video>

                    <!-- PiP: shows face MESH ONLY (no camera image) -->
                    <div class="webcam-pip" style=${{display: camState==='active'&&!useAudio&&aiState==='ready' ? 'block' : 'none'}}>
                        <canvas ref=${pipCanvasRef} width="200" height="150"
                            style=${{width:'100%',height:'100%',display:'block'}}>
                        </canvas>
                        <div class="pip-label">🟢 顔メッシュ</div>
                    </div>
                </div>

                <!-- RIGHT MODAL (SETTINGS) -->
                ${showMenu && html`
                    <div class="modal-overlay" onClick=${()=>setShowMenu(false)}>
                        <div class="control-panel modal-content" onClick=${e=>e.stopPropagation()}>
                            <div class="modal-header">
                                <h2>⚙️ 設定・アバター調整</h2>
                                <button class="modal-close-btn" onClick=${()=>setShowMenu(false)}>✕</button>
                            </div>

                            <!-- カメラ起動ボタン -->
                            <div class="panel-card">
                                <h2>📷 カメラ接続</h2>
                                <div class="control-group">
                                    <div style=${{display:'flex',gap:'8px'}}>
                                        <button class="btn ${!useAudio?'btn-primary':'btn-secondary'}" style=${{flex:1}}
                                            onClick=${()=>handleModeChange(false)}>📷 カメラ</button>
                                        <button class="btn ${useAudio?'btn-primary':'btn-secondary'}"  style=${{flex:1}}
                                            onClick=${()=>handleModeChange(true)}>🎤 マイク</button>
                                    </div>

                                    ${!useAudio && camState==='idle' && html`
                                        <button class="btn btn-primary" id="start-camera-btn" onClick=${startCamera}>
                                            📷 カメラを起動する
                                        </button>
                                    `}
                                    ${!useAudio && camState==='error' && html`
                                        <button class="btn btn-secondary" onClick=${startCamera}>🔄 再試行</button>
                                    `}
                                    ${camState==='loading' && html`
                                        <div style=${{textAlign:'center',padding:'8px',color:'var(--text-muted)'}}>
                                            <div class="spinner" style=${{width:'22px',height:'22px',margin:'0 auto 6px'}}></div>
                                            <span style=${{fontSize:'12px'}}>接続中...</span>
                                        </div>
                                    `}
                                    ${camState==='active' && !useAudio && html`
                                        <div style=${{fontSize:'12px',color:'#10b981',padding:'6px 10px',background:'rgba(16,185,129,0.1)',borderRadius:'8px'}}>
                                            ${aiState==='ready'   ? '✅ AI顔トラッキング ON' :
                                              aiState==='loading' ? '⏳ AIモデル読込中...' :
                                                                    '⚠️ 簡易トラッキング'}
                                        </div>
                                    `}
                                </div>
                            </div>

                            <!-- キャラ選択 -->
                            <div class="panel-card">
                                <h2>👤 キャラクターを選ぶ</h2>
                                <div class="presets-grid">
                                    ${PRESETS.map(p => html`
                                        <div key=${p.id} class="preset-item ${preset.id===p.id&&!photo?'active':''}"
                                            onClick=${()=>{setPhoto(null);setPreset(p);}}>
                                            <img src=${p.url} alt=${p.name} />
                                        </div>
                                    `)}
                                </div>
                                <${UploadZone} onImage=${url=>setPhoto(url)} />
                            </div>

                            <!-- キャラ位置・パーツの微調整 -->
                            <div class="panel-card">
                                <h2>👁️ パーツの微調整 (目・口)</h2>
                                <div class="control-group">
                                    <div class="slider-container">
                                        <div class="slider-label"><span>目の間隔</span><span class="slider-value">${(offsets.eyeSpacing*100).toFixed(1)}%</span></div>
                                        <input type="range" min="-0.1" max="0.1" step="0.005" value=${offsets.eyeSpacing}
                                            onChange=${e=>setOffsets(p=>({...p, eyeSpacing: +e.target.value}))} />
                                    </div>
                                    <div class="slider-container">
                                        <div class="slider-label"><span>目の高さ</span><span class="slider-value">${(offsets.eyeY*100).toFixed(1)}%</span></div>
                                        <input type="range" min="-0.1" max="0.1" step="0.005" value=${offsets.eyeY}
                                            onChange=${e=>setOffsets(p=>({...p, eyeY: +e.target.value}))} />
                                    </div>
                                    <div class="slider-container">
                                        <div class="slider-label"><span>目のサイズ</span><span class="slider-value">${offsets.eyeScale.toFixed(2)}倍</span></div>
                                        <input type="range" min="0.3" max="3.0" step="0.05" value=${offsets.eyeScale}
                                            onChange=${e=>setOffsets(p=>({...p, eyeScale: +e.target.value}))} />
                                    </div>
                                    <div class="slider-container" style=${{borderTop:'1px solid var(--border-color)', paddingTop:'10px', marginTop:'6px'}}>
                                        <div class="slider-label"><span>口の左右位置</span><span class="slider-value">${(offsets.mouthX*100).toFixed(1)}%</span></div>
                                        <input type="range" min="-0.1" max="0.1" step="0.005" value=${offsets.mouthX}
                                            onChange=${e=>setOffsets(p=>({...p, mouthX: +e.target.value}))} />
                                    </div>
                                    <div class="slider-container">
                                        <div class="slider-label"><span>口の上下位置</span><span class="slider-value">${(offsets.mouthY*100).toFixed(1)}%</span></div>
                                        <input type="range" min="-0.1" max="0.1" step="0.005" value=${offsets.mouthY}
                                            onChange=${e=>setOffsets(p=>({...p, mouthY: +e.target.value}))} />
                                    </div>
                                    <div class="slider-container">
                                        <div class="slider-label"><span>口のサイズ</span><span class="slider-value">${offsets.mouthScale.toFixed(2)}倍</span></div>
                                        <input type="range" min="0.3" max="3.0" step="0.05" value=${offsets.mouthScale}
                                            onChange=${e=>setOffsets(p=>({...p, mouthScale: +e.target.value}))} />
                                    </div>
                                </div>
                            </div>

                            <!-- 感度調整 -->
                            <div class="panel-card">
                                <h2>⚙️ 感度設定</h2>
                                <div class="control-group">
                                    ${[
                                        {k:'head',  label:'頭の動き',    min:0.2, max:2.0, step:0.1},
                                        {k:'blink', label:'まばたき',    min:0.5, max:2.0, step:0.1},
                                        {k:'mouth', label:'口の開き',    min:0.5, max:2.0, step:0.1},
                                        {k:'smooth',label:'スムージング',min:0.05,max:0.9, step:0.05}
                                    ].map(({k,label,min,max,step}) => html`
                                        <div class="slider-container" key=${k}>
                                            <div class="slider-label">
                                                <span>${label}</span>
                                                <span class="slider-value">${sens[k].toFixed(k==='smooth'?2:1)}</span>
                                            </div>
                                            <input type="range" min=${min} max=${max} step=${step} value=${sens[k]}
                                                onChange=${e=>setSens(p=>({...p,[k]:+e.target.value}))} />
                                        </div>
                                    `)}
                                </div>
                            </div>

                            <!-- 背景 & アクセサリー -->
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
                                        ${ACCS.map(a => html`
                                            <button key=${a.id} class="accessory-btn ${acc===a.id?'active':''}" onClick=${()=>setAcc(a.id)}>
                                                <span class="accessory-btn-icon">${a.emoji}</span>
                                                <span>${a.name}</span>
                                            </button>
                                        `)}
                                    </div>
                                </div>
                            </div>

                            <${RecordCard} isRec=${isRec} setIsRec=${setIsRec} recSec=${recSec} setRecSec=${setRecSec} />
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
    `;
}

// ══════════════ UPLOAD ZONE ══════════════
function UploadZone({ onImage }) {
    const [drag, setDrag] = useState(false);
    const ref = useRef();
    const process = f => {
        if (!f?.type.startsWith('image/')) return;
        const r=new FileReader(); r.onload=e=>onImage(e.target.result); r.readAsDataURL(f);
    };
    return html`
        <div class="upload-zone ${drag?'drag-active':''}"
            onDragEnter=${e=>{e.preventDefault();setDrag(true);}}
            onDragOver=${e=>{e.preventDefault();setDrag(true);}}
            onDragLeave=${e=>{e.preventDefault();setDrag(false);}}
            onDrop=${e=>{e.preventDefault();setDrag(false);process(e.dataTransfer.files[0]);}}
            onClick=${()=>ref.current.click()}>
            <input ref=${ref} type="file" accept="image/*" style=${{display:'none'}} onChange=${e=>process(e.target.files[0])} />
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                style=${{marginBottom:'8px',color:'var(--text-muted)'}}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4-4 4 4 4-8 4 4M4 20h16"/>
            </svg>
            <p>自分の画像をアップロード</p>
            <span>クリック / ドラッグ＆ドロップ</span>
        </div>
    `;
}

// ── Automatic background removal keying ──
// Samples top-left pixel color and makes all similar pixels transparent.
function removeBackground(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Sample top-left pixel (x=0, y=0)
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const bgA = data[3];

    if (bgA === 0) return canvas; // Already transparent

    const threshold = 40; // color distance threshold for transparency

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const dist = Math.sqrt((r - bgR)**2 + (g - bgG)**2 + (b - bgB)**2);
        if (dist < threshold) {
            data[i+3] = 0; // Set alpha to 0
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

// ══════════════ AVATAR CANVAS ══════════════
// Draws the character image and overlays (mouth, blink, accessories)
// using charFaceRef for accurate feature positioning.
function AvatarCanvas({ url, trackRef, sensRef, useAudio, acc, charFaceRef, offsets }) {
    const contRef = useRef();
    const cvRef   = useRef();
    const imgRef  = useRef();
    const rafRef  = useRef();
    const emaRef  = useRef({ yaw:0, pitch:0, roll:0, mouth:0, bL:0, bR:0 });
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(false);
        const img = new Image();
        img.onload  = () => {
            try {
                imgRef.current = removeBackground(img);
            } catch(e) {
                console.warn('Background removal failed:', e);
                imgRef.current = img;
            }
            setReady(true);
        };
        img.onerror = () => { console.error('Image load failed:', url); };
        img.src = url;
    }, [url]);

    useEffect(() => {
        const resize = () => {
            const cv=cvRef.current, cont=contRef.current;
            if (!cv||!cont) return;
            const w=cont.offsetWidth, h=cont.offsetHeight;
            if (w>0) cv.width=w;
            if (h>0) cv.height=h;
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    useEffect(() => {
        if (!ready) return;
        const cv = cvRef.current; if (!cv) return;
        const cont = contRef.current;
        if (cont && (cv.width===0||cv.height===0)) {
            cv.width = cont.offsetWidth||400; cv.height = cont.offsetHeight||600;
        }

        const draw = () => {
            const W=cv.width, H=cv.height, img=imgRef.current;
            const ctx = cv.getContext('2d');
            ctx.clearRect(0,0,W,H);
            if (!img||W===0||H===0) { rafRef.current=requestAnimationFrame(draw); return; }

            const tr=trackRef.current, s=sensRef.current;
            const a=Math.min(0.95,s.smooth), e=emaRef.current;

            e.yaw   = e.yaw   * a + (tr.yaw   ||0) * (1-a);
            e.pitch = e.pitch * a + (tr.pitch  ||0) * (1-a);
            e.roll  = e.roll  * a + (tr.roll   ||0) * (1-a);
            e.mouth = e.mouth * a + (useAudio?(tr.audioMouth||0):(tr.mouthOpen||0)) * (1-a);
            e.bL    = e.bL    * a + (tr.blinkL ||0) * (1-a);
            e.bR    = e.bR    * a + (tr.blinkR ||0) * (1-a);

            // Image fit (contain)
            const ia=img.width/img.height, ca=W/H;
            let iW,iH,iX,iY;
            if (ia>ca) { iW=W; iH=W/ia; iX=0;       iY=(H-iH)/2; }
            else        { iH=H; iW=H*ia; iX=(W-iW)/2; iY=0;        }

            // Head pivot (for rotation)
            const pivX=iX+iW*0.5, pivY=iY+iH*0.42;
            const offX=e.yaw  *iW*0.10;
            const offY=e.pitch*iH*0.07;
            const rr  =e.roll *0.5;

            // ── Draw the character image ──
            ctx.save();
            ctx.translate(pivX+offX, pivY+offY);
            ctx.rotate(rr);
            ctx.translate(-pivX,-pivY);
            ctx.drawImage(img,iX,iY,iW,iH);
            ctx.restore();

            // ── Get analyzed face positions (or fallback defaults) ──
            const face = charFaceRef.current;

            // Helper: convert normalized image coords → canvas coords (with head motion applied)
            const toCanvas = (nx, ny) => {
                const px = iX + nx*iW;
                const py = iY + ny*iH;
                const dx = px - pivX, dy = py - pivY;
                const cos = Math.cos(rr), sin = Math.sin(rr);
                return {
                    x: pivX + dx*cos - dy*sin + offX,
                    y: pivY + dx*sin + dy*cos + offY
                };
            };

            // ── Mouth open overlay ──
            const mo = Math.max(0, e.mouth - 0.03);
            if (mo > 0) {
                const mcx = face ? face.mouthCx : 0.5;
                const mcy = face ? face.mouthCy : 0.72;
                const mw  = face ? face.mouthW  : 0.12;
                const mc  = toCanvas(mcx + (offsets?.mouthX || 0), mcy + (offsets?.mouthY || 0));
                const mwPx = mw * iW * 0.9 * (offsets?.mouthScale || 1.0);
                const mhPx = iH * 0.018 * (1 + mo * 5.0) * (offsets?.mouthScale || 1.0);

                ctx.save();
                ctx.translate(mc.x, mc.y); ctx.rotate(rr);
                ctx.beginPath(); ctx.ellipse(0,0,mwPx,mhPx,0,0,Math.PI*2);
                ctx.fillStyle='rgba(8,3,3,0.82)'; ctx.fill();
                ctx.restore();
            }

            // ── Blink overlays ──
            const eyeSpacingOffset = offsets?.eyeSpacing || 0;
            const eyeYOffset = offsets?.eyeY || 0;
            const eyeScaleVal = offsets?.eyeScale || 1.0;

            const blinkData = face ? [
                { blink: e.bL, nx: face.lEye.x - eyeSpacingOffset, ny: face.lEye.y + eyeYOffset },
                { blink: e.bR, nx: face.rEye.x + eyeSpacingOffset, ny: face.rEye.y + eyeYOffset }
            ] : [
                { blink: e.bL, nx: 0.36 - eyeSpacingOffset, ny: 0.40 + eyeYOffset },
                { blink: e.bR, nx: 0.64 + eyeSpacingOffset, ny: 0.40 + eyeYOffset }
            ];

            blinkData.forEach(({blink, nx, ny}) => {
                if (blink < 0.15) return;
                const eyeW = face ? (face.mouthW * iW * 0.7) : (iW * 0.09);
                const eyeW_scaled = eyeW * eyeScaleVal;
                const eyeH = eyeW_scaled * 0.12 * blink * 3.0;
                const ec = toCanvas(nx, ny);
                ctx.save();
                ctx.translate(ec.x, ec.y); ctx.rotate(rr);
                ctx.beginPath(); ctx.ellipse(0,0,eyeW_scaled,eyeH,0,0,Math.PI*2);
                ctx.fillStyle='rgba(200,160,110,0.88)'; ctx.fill();
                ctx.restore();
            });

            // ── Accessory emoji ──
            if (acc !== 'none') {
                const emap={glasses:'🕶️',crown:'👑',ears:'🐱'};
                const emoji = emap[acc];
                if (emoji) {
                    const glassesNX = face ? (face.lEye.x+face.rEye.x)/2 : 0.5;
                    const glassesNY = face ? (face.lEye.y+face.rEye.y)/2 : 0.40;
                    const eyeGap    = face ? Math.abs(face.rEye.x - face.lEye.x) : 0.28;
                    const fs = eyeGap * iW * 1.1;
                    const ay = acc==='glasses' ? glassesNY : acc==='crown' ? 0.04 : 0.06;
                    const ac = toCanvas(glassesNX, ay);
                    ctx.save();
                    ctx.font=`${fs}px Arial`;
                    ctx.textAlign='center'; ctx.textBaseline='middle';
                    ctx.translate(ac.x, ac.y); ctx.rotate(rr);
                    ctx.fillText(emoji, 0, 0);
                    ctx.restore();
                }
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [ready, acc, useAudio, offsets]);

    return html`
        <div ref=${contRef} style=${{width:'100%',height:'100%',position:'absolute',top:0,left:0}}>
            ${!ready && html`
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">画像を読み込み中...</div>
                </div>
            `}
            <canvas ref=${cvRef} id="avatar-canvas"
                style=${{width:'100%',height:'100%',display:ready?'block':'none'}}>
            </canvas>
        </div>
    `;
}

// ══════════════ RECORDING ══════════════
function RecordCard({ isRec, setIsRec, recSec, setRecSec }) {
    const recRef=useRef(); const timerRef=useRef();
    const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    useEffect(()=>{
        if(isRec){timerRef.current=setInterval(()=>setRecSec(p=>p+1),1000);}
        else{clearInterval(timerRef.current);setRecSec(0);}
        return ()=>clearInterval(timerRef.current);
    },[isRec]);
    const start = async () => {
        const cv=document.getElementById('avatar-canvas'); if(!cv) return;
        const vs=cv.captureStream(30), cm=new MediaStream([...vs.getVideoTracks()]);
        try{const mic=await navigator.mediaDevices.getUserMedia({audio:true});mic.getAudioTracks().forEach(t=>cm.addTrack(t));}catch(_){}
        const rec=new MediaRecorder(cm); const chunks=[];
        rec.ondataavailable=e=>e.data.size>0&&chunks.push(e.data);
        rec.onstop=()=>{
            const b=new Blob(chunks,{type:'video/webm'});
            const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:`vtuber-${Date.now()}.webm`});
            document.body.appendChild(a);a.click();a.remove();
        };
        rec.start(1000); recRef.current=rec; setIsRec(true);
    };
    return html`
        <div class="panel-card">
            <h2>📹 録画・ダウンロード</h2>
            <div class="control-group">
                <p style=${{fontSize:'12px',color:'var(--text-muted)'}}>アバター画面とマイクをWebMで保存。</p>
                ${isRec&&html`<div class="recording-bar"><span class="recording-dot"></span><span>録画中: ${fmt(recSec)}</span></div>`}
                ${!isRec
                    ?html`<button class="btn btn-primary" onClick=${start}>🔴 録画開始</button>`
                    :html`<button class="btn btn-danger" onClick=${()=>{recRef.current?.stop();setIsRec(false);}}>⏹ 停止して保存</button>`}
            </div>
        </div>
    `;
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
