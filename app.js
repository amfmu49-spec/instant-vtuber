import htm from 'https://esm.sh/htm';

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef } = React;

// ── 定数 ──
const PRESETS = [
    { id:'girl', name:'Anime Girl',    url:'presets/girl.png' },
    { id:'boy',  name:'Cyberpunk Boy', url:'presets/boy.png'  },
    { id:'cat',  name:'Cute Cat',      url:'presets/cat.png'  }
];
const BG_STYLES = [
    { id:'green',    name:'グリーン',  bg:'#00b140' },
    { id:'studio',   name:'スタジオ',  bg:'linear-gradient(160deg,#1a1a2e,#0f3460)' },
    { id:'neon',     name:'ネオン',     bg:'linear-gradient(135deg,#0d0221,#190733)' },
    { id:'grad',     name:'グラデ',    bg:'linear-gradient(135deg,#1a1a2e,#0f3460)' }
];
const ACCS = [
    { id:'none', name:'なし', emoji:'❌' },
    { id:'glasses', name:'めがね', emoji:'🕶️' },
    { id:'crown', name:'王冠', emoji:'👑' },
    { id:'ears', name:'ネコミミ', emoji:'🐱' }
];

// MediaPipe CDN
const MP_BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs';
const MP_WASM   = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';
const MP_MODEL  = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ══════════════ APP ══════════════
function App() {
    const [preset, setPreset]   = useState(PRESETS[0]);
    const [photo,  setPhoto]    = useState(null);     // uploaded data URL
    const [bgIdx,  setBgIdx]    = useState(3);
    const [acc,    setAcc]      = useState('none');
    const [useAudio, setAudio]  = useState(false);
    const [camState, setCam]    = useState('idle');   // idle|loading|active|error
    const [aiState,  setAI]     = useState('none');   // none|loading|ready|fail
    const [isRec,  setRec]      = useState(false);
    const [recSec, setRecSec]   = useState(0);
    const [sens, setSens]       = useState({ head:1.0, blink:1.2, mouth:1.0, smooth:0.6 });

    // Live tracking data — written by CameraTracker, read every frame by AvatarCanvas
    const trackRef = useRef({ yaw:0, pitch:0, roll:0, blinkL:0, blinkR:0, mouthOpen:0, audioMouth:0 });
    const sensRef  = useRef(sens);
    useEffect(() => { sensRef.current = sens; }, [sens]);

    const avatarUrl = photo || preset.url;

    return html`
        <div class="app-container">
            <!-- Header -->
            <header>
                <div class="logo-section">
                    <h1>✨ Instant VTuber</h1>
                    <p>1枚の画像で誰でもVTuber になれる！</p>
                </div>
                <div class="status-bar">
                    <div class="status-indicator">
                        <span class="status-dot ${camState==='active'?'active':camState==='loading'?'loading':camState==='error'?'error':''}"></span>
                        <span style=${{fontSize:'12px'}}>
                            ${camState==='active' ? (aiState==='ready'?'🟢 AIトラッキング中':aiState==='loading'?'⏳ AIモデル読込中...':'📷 カメラ起動中...') :
                              camState==='loading' ? '接続中...' :
                              camState==='error'   ? 'カメラエラー' : '待機中'}
                        </span>
                    </div>
                </div>
            </header>

            <div class="workspace">
                <!-- LEFT: Canvas + Camera PiP -->
                <div class="avatar-view" style=${{ background: BG_STYLES[bgIdx].bg }}>
                    <${AvatarCanvas} url=${avatarUrl} trackRef=${trackRef} sensRef=${sensRef} useAudio=${useAudio} acc=${acc} />
                    <${CameraTracker}
                        camState=${camState} setCam=${setCam}
                        aiState=${aiState}   setAI=${setAI}
                        useAudio=${useAudio}
                        trackRef=${trackRef} sensRef=${sensRef}
                    />
                </div>

                <!-- RIGHT: Controls -->
                <div class="control-panel">
                    <!-- キャラ選択 -->
                    <div class="panel-card">
                        <h2>👤 キャラクターを選ぶ</h2>
                        <div class="presets-grid">
                            ${PRESETS.map(p=>html`
                                <div key=${p.id} class="preset-item ${preset.id===p.id&&!photo?'active':''}"
                                    onClick=${()=>{setPhoto(null);setPreset(p);}}>
                                    <img src=${p.url} alt=${p.name} />
                                </div>
                            `)}
                        </div>
                        <${UploadZone} onImage=${url=>setPhoto(url)} />
                    </div>

                    <!-- トラッキング -->
                    <div class="panel-card">
                        <h2>⚙️ トラッキング</h2>
                        <div class="control-group">
                            <div style=${{display:'flex',gap:'8px'}}>
                                <button class="btn ${!useAudio?'btn-primary':'btn-secondary'}" style=${{flex:1}} onClick=${()=>setAudio(false)}>📷 カメラ</button>
                                <button class="btn ${useAudio?'btn-primary':'btn-secondary'}"  style=${{flex:1}} onClick=${()=>setAudio(true)}>🎤 マイク</button>
                            </div>

                            ${!useAudio && camState==='idle' && html`
                                <button class="btn btn-primary" onClick=${()=>setCam('start')}>📷 カメラを起動する</button>
                            `}
                            ${!useAudio && camState==='error' && html`
                                <button class="btn btn-secondary" onClick=${()=>setCam('start')}>🔄 再試行</button>
                                <div style=${{fontSize:'12px',color:'#ef4444',padding:'8px',background:'rgba(239,68,68,0.1)',borderRadius:'8px'}}>
                                    カメラへのアクセスが拒否されました。ブラウザの設定でカメラを許可してください。
                                </div>
                            `}
                            ${camState==='active' && !useAudio && html`
                                <div style=${{fontSize:'12px',color:'#10b981',padding:'6px 10px',background:'rgba(16,185,129,0.1)',borderRadius:'8px'}}>
                                    ${aiState==='ready'   ? '✅ AIトラッキング ON！顔を動かしてみてください。' :
                                      aiState==='loading' ? '⏳ AIモデルをダウンロード中... (数十秒かかることがあります)' :
                                      aiState==='fail'    ? '⚠️ AIなしで動作中 (カメラ映像で簡易トラッキング)' :
                                                            '📷 カメラ接続完了'}
                                </div>
                            `}

                            ${[
                                {k:'head',  label:'頭の動き',   min:0.2, max:2.0, step:0.1},
                                {k:'blink', label:'まばたき',   min:0.5, max:2.0, step:0.1},
                                {k:'mouth', label:'口の開き',   min:0.5, max:2.0, step:0.1},
                                {k:'smooth',label:'スムージング',min:0.05,max:0.9, step:0.05}
                            ].map(({k,label,min,max,step})=>html`
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
                                ${BG_STYLES.map((bg,i)=>html`
                                    <button key=${bg.id} class="bg-option-btn ${bgIdx===i?'active':''}"
                                        style=${{background:bg.bg}} onClick=${()=>setBgIdx(i)}>
                                        <span>${bg.name}</span>
                                    </button>
                                `)}
                            </div>
                            <div class="slider-label" style=${{marginTop:'10px'}}><span>アクセサリー</span></div>
                            <div class="accessory-options">
                                ${ACCS.map(a=>html`
                                    <button key=${a.id} class="accessory-btn ${acc===a.id?'active':''}" onClick=${()=>setAcc(a.id)}>
                                        <span class="accessory-btn-icon">${a.emoji}</span>
                                        <span>${a.name}</span>
                                    </button>
                                `)}
                            </div>
                        </div>
                    </div>

                    <${RecordCard} isRec=${isRec} setRec=${setRec} recSec=${recSec} setRecSec=${setRecSec} />
                </div>
            </div>
        </div>
    `;
}

// ══════════════ UPLOAD ZONE ══════════════
function UploadZone({ onImage }) {
    const [drag, setDrag] = useState(false);
    const ref = useRef();
    const process = f => { if(!f?.type.startsWith('image/')) return; const r=new FileReader(); r.onload=e=>onImage(e.target.result); r.readAsDataURL(f); };
    return html`
        <div class="upload-zone ${drag?'drag-active':''}"
            onDragEnter=${e=>{e.preventDefault();setDrag(true);}}
            onDragOver=${e=>{e.preventDefault();setDrag(true);}}
            onDragLeave=${e=>{e.preventDefault();setDrag(false);}}
            onDrop=${e=>{e.preventDefault();setDrag(false);process(e.dataTransfer.files[0]);}}
            onClick=${()=>ref.current.click()}>
            <input ref=${ref} type="file" accept="image/*" style=${{display:'none'}} onChange=${e=>process(e.target.files[0])} />
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style=${{marginBottom:'8px',color:'var(--text-muted)'}}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4-4 4 4 4-8 4 4M4 20h16"/>
            </svg>
            <p>自分の画像をアップロード</p>
            <span>クリック / ドラッグ＆ドロップ</span>
        </div>
    `;
}

// ══════════════ CAMERA TRACKER ══════════════
function CameraTracker({ camState, setCam, aiState, setAI, useAudio, trackRef, sensRef }) {
    const videoRef  = useRef();
    const pipCvRef  = useRef();
    const rafRef    = useRef();
    const streamRef = useRef();
    const lmRef     = useRef();
    const emaRef    = useRef({roll:0,yaw:0,pitch:0,bL:0,bR:0,mo:0});
    const audioR    = useRef({ctx:null,analyser:null,stream:null});
    // mountedRef survives all state changes — only false after component unmounts
    const mountedRef = useRef(true);

    useEffect(()=>{
        mountedRef.current = true;
        return ()=>{ mountedRef.current = false; stopAll(); };
    }, []);

    const stopAll = () => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t=>t.stop());
        audioR.current.ctx?.close();
        audioR.current.stream?.getTracks().forEach(t=>t.stop());
    };

    // ── Audio mode ──
    useEffect(()=>{
        if(!useAudio) return;
        let alive=true;
        (async()=>{
            try {
                const stream = await navigator.mediaDevices.getUserMedia({audio:true});
                if(!alive){stream.getTracks().forEach(t=>t.stop());return;}
                const ctx = new (window.AudioContext||window.webkitAudioContext)();
                const an  = ctx.createAnalyser(); an.fftSize=256;
                ctx.createMediaStreamSource(stream).connect(an);
                audioR.current = {ctx,analyser:an,stream};
                setCam('active');
                const run=()=>{
                    const data=new Uint8Array(an.frequencyBinCount);
                    an.getByteFrequencyData(data);
                    const avg=data.reduce((s,v)=>s+v,0)/data.length;
                    const s=sensRef.current;
                    const now=performance.now()*0.001;
                    trackRef.current.audioMouth = Math.min(1, avg/40)*s.mouth;
                    trackRef.current.roll  = Math.sin(now*0.7)*0.03;
                    trackRef.current.yaw   = Math.cos(now*0.5)*0.04;
                    trackRef.current.pitch = Math.sin(now*0.3)*0.02;
                    if(alive) rafRef.current=requestAnimationFrame(run);
                };
                run();
            } catch(e){ if(alive) setCam('error'); }
        })();
        return ()=>{ alive=false; cancelAnimationFrame(rafRef.current); audioR.current.ctx?.close(); audioR.current.stream?.getTracks().forEach(t=>t.stop()); };
    },[useAudio]);

    // ── Camera start: watch for 'start', run async without killing via effect cleanup ──
    useEffect(()=>{
        if(camState!=='start') return;
        // Fire-and-forget: don't return a cleanup that sets alive=false.
        // mountedRef handles component unmount safety instead.
        doStartCamera();
    // eslint-disable-next-line
    },[camState]);

    const doStartCamera = async () => {
        setCam('loading');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} }
            });
            if(!mountedRef.current){ stream.getTracks().forEach(t=>t.stop()); return; }
            streamRef.current = stream;

            const vid = videoRef.current;
            vid.srcObject = stream;

            // Use loadedmetadata event instead of await play() to avoid iOS hang
            await new Promise((resolve) => {
                vid.onloadedmetadata = () => {
                    vid.play().then(resolve).catch(resolve);
                };
                // Fallback: if metadata never fires, resolve after 4s
                setTimeout(resolve, 4000);
            });

            if(!mountedRef.current) return;
            setCam('active');
            doLoadMP(); // load MediaPipe in background
        } catch(e){
            console.error('Camera error:',e);
            if(mountedRef.current) setCam('error');
        }
    };

    const doLoadMP = async () => {
        setAI('loading');
        try {
            const {FaceLandmarker,FilesetResolver} = await import(MP_BUNDLE);
            if(!mountedRef.current) return;
            const vfs = await FilesetResolver.forVisionTasks(MP_WASM);
            if(!mountedRef.current) return;
            const lm  = await FaceLandmarker.createFromOptions(vfs, {
                baseOptions:{modelAssetPath:MP_MODEL},
                runningMode:'VIDEO', outputFaceBlendshapes:true, numFaces:1
            });
            if(!mountedRef.current){ lm.close(); return; }
            lmRef.current = lm;
            setAI('ready');
            cancelAnimationFrame(rafRef.current);
            runFaceLoop();
        } catch(e) {
            console.warn('MediaPipe failed, using pixel-diff fallback:',e);
            if(mountedRef.current){ setAI('fail'); cancelAnimationFrame(rafRef.current); runPixelLoop(); }
        }
    };

    // Full MediaPipe loop
    const runFaceLoop = () => {
        const vid=videoRef.current, lm=lmRef.current;
        if(!vid||!lm) return;
        const loop=()=>{
            if(vid.readyState>=2){
                const res=lm.detectForVideo(vid,performance.now());
                if(res.faceLandmarks?.length>0){
                    const pts=res.faceLandmarks[0];
                    const bs={};
                    res.faceBlendshapes?.[0]?.categories?.forEach(c=>bs[c.categoryName]=c.score);

                    const pL=pts[263],pR=pts[33],pN=pts[4],pC=pts[152];
                    const rawRoll = Math.atan2(pL.y-pR.y, pL.x-pR.x);
                    const dL=Math.hypot(pN.x-pL.x,pN.y-pL.y), dR=Math.hypot(pN.x-pR.x,pN.y-pR.y);
                    const rawYaw  = (dL-dR)/(dL+dR)*2.2;
                    const eyeCy   = (pL.y+pR.y)/2;
                    const rawPitch= ((pC.y-pN.y)-(pN.y-eyeCy))/((pC.y-pN.y)+(pN.y-eyeCy))*1.5-0.4;

                    const s=sensRef.current, a=s.smooth, e=emaRef.current;
                    e.roll =e.roll *a+rawRoll *(1-a);
                    e.yaw  =e.yaw  *a+rawYaw  *(1-a);
                    e.pitch=e.pitch*a+rawPitch*(1-a);
                    e.bL   =e.bL   *a+(bs['eyeBlinkLeft'] ||0)*(1-a);
                    e.bR   =e.bR   *a+(bs['eyeBlinkRight']||0)*(1-a);
                    e.mo   =e.mo   *a+(bs['jawOpen']       ||0)*(1-a);

                    const tr=trackRef.current;
                    tr.yaw      = e.yaw  *s.head;
                    tr.pitch    = e.pitch*s.head;
                    tr.roll     = e.roll *s.head;
                    tr.blinkL   = Math.min(1,  e.bL*s.blink);
                    tr.blinkR   = Math.min(1,  e.bR*s.blink);
                    tr.mouthOpen= Math.min(1.2,e.mo*s.mouth);
                    tr.audioMouth=0;

                    // Draw green dots on PiP canvas
                    const c=pipCvRef.current;
                    if(c){const cx=c.getContext('2d');cx.clearRect(0,0,c.width,c.height);cx.fillStyle='#10b981';for(let i=0;i<pts.length;i+=5){cx.beginPath();cx.arc(pts[i].x*c.width,pts[i].y*c.height,1,0,Math.PI*2);cx.fill();}}
                }
            }
            rafRef.current=requestAnimationFrame(loop);
        };
        loop();
    };

    // Pixel-diff fallback
    const runPixelLoop = () => {
        const vid=videoRef.current; if(!vid) return;
        const off=document.createElement('canvas'); off.width=32; off.height=32;
        const oc=off.getContext('2d');
        let prev=null;
        const loop=()=>{
            if(vid.readyState>=2){
                oc.drawImage(vid,0,0,32,32);
                const cur=oc.getImageData(0,0,32,32).data;
                if(prev){
                    let sx=0,sy=0,tot=0;
                    for(let y=0;y<32;y++) for(let x=0;x<32;x++){
                        const i=(y*32+x)*4;
                        const d=Math.abs(cur[i]-prev[i])+Math.abs(cur[i+1]-prev[i+1])+Math.abs(cur[i+2]-prev[i+2]);
                        sx+=d*(x-16); sy+=d*(y-16); tot+=d;
                    }
                    if(tot>200){
                        const s=sensRef.current,a=s.smooth,e=emaRef.current;
                        e.yaw  =e.yaw  *a+(sx/tot/16)*(1-a)*0.5;
                        e.pitch=e.pitch*a+(sy/tot/16)*(1-a)*0.4;
                        const tr=trackRef.current;
                        tr.yaw=e.yaw*s.head; tr.pitch=e.pitch*s.head;
                    }
                }
                prev=new Uint8ClampedArray(cur);
            }
            rafRef.current=requestAnimationFrame(loop);
        };
        loop();
    };

    return html`
        <div class="webcam-pip" style=${{display:camState==='active'&&!useAudio?'block':'none'}}>
            <video ref=${videoRef} playsinline muted></video>
            <canvas ref=${pipCvRef} width="160" height="120"></canvas>
            <div class="pip-label">${aiState==='ready'?'🟢 AI ON':aiState==='loading'?'⏳ AI読込...':aiState==='fail'?'🟡 簡易':'📷'}</div>
        </div>
    `;
}

// ══════════════ AVATAR CANVAS ══════════════
// This component ONLY deals with drawing the image.
// It has NO dependency on MediaPipe or camera.
function AvatarCanvas({ url, trackRef, sensRef, useAudio, acc }) {
    const contRef = useRef();
    const cvRef   = useRef();
    const imgRef  = useRef();
    const rafRef  = useRef();
    const emaRef  = useRef({yaw:0,pitch:0,roll:0,mouth:0,bL:0,bR:0});
    const [ready, setReady] = useState(false);

    // ── Load image whenever URL changes ──
    useEffect(()=>{
        setReady(false);
        const img=new Image();
        img.onload =()=>{ imgRef.current=img; setReady(true); };
        img.onerror=()=>{ console.error('Image failed to load:', url); };
        img.src = url;
    },[url]);

    // ── Set canvas pixel size on resize ──
    useEffect(()=>{
        const resize=()=>{
            const cv=cvRef.current, cont=contRef.current;
            if(!cv||!cont) return;
            cv.width =cont.clientWidth  || cont.offsetWidth;
            cv.height=cont.clientHeight || cont.offsetHeight;
        };
        resize();
        window.addEventListener('resize',resize);
        return ()=>window.removeEventListener('resize',resize);
    },[]);

    // ── Render loop ──
    useEffect(()=>{
        if(!ready) return;

        const cv=cvRef.current;
        if(!cv) return;

        // Make sure the canvas has real pixel dimensions
        if(cv.width===0||cv.height===0){
            const cont=contRef.current;
            if(cont){ cv.width=cont.offsetWidth; cv.height=cont.offsetHeight; }
        }

        const draw=()=>{
            const ctx=cv.getContext('2d');
            const W=cv.width, H=cv.height;
            const img=imgRef.current;

            ctx.clearRect(0,0,W,H);

            if(!img||W===0||H===0){ rafRef.current=requestAnimationFrame(draw); return; }

            // Read tracking data
            const tr=trackRef.current;
            const s=sensRef.current;
            const a=Math.min(0.95,s.smooth);
            const e=emaRef.current;

            const srcYaw  =tr.yaw   ||0;
            const srcPitch=tr.pitch ||0;
            const srcRoll =tr.roll  ||0;
            const srcMouth=useAudio ? (tr.audioMouth||0) : (tr.mouthOpen||0);
            const srcBL   =tr.blinkL||0;
            const srcBR   =tr.blinkR||0;

            e.yaw  =e.yaw  *a+srcYaw  *(1-a);
            e.pitch=e.pitch*a+srcPitch*(1-a);
            e.roll =e.roll *a+srcRoll *(1-a);
            e.mouth=e.mouth*a+srcMouth*(1-a);
            e.bL   =e.bL   *a+srcBL   *(1-a);
            e.bR   =e.bR   *a+srcBR   *(1-a);

            // Scale image to canvas (contain)
            const ia=img.naturalWidth/img.naturalHeight, ca=W/H;
            let iW,iH,iX,iY;
            if(ia>ca){iW=W;iH=W/ia;iX=0;iY=(H-iH)/2;}
            else     {iH=H;iW=H*ia;iX=(W-iW)/2;iY=0;}

            const pivX=iX+iW*0.5, pivY=iY+iH*0.42;
            const offX=e.yaw  *iW*0.10;
            const offY=e.pitch*iH*0.07;
            const rr  =e.roll *0.5;

            // Draw image with head tilt/translation
            ctx.save();
            ctx.translate(pivX+offX, pivY+offY);
            ctx.rotate(rr);
            ctx.translate(-pivX,-pivY);
            ctx.drawImage(img,iX,iY,iW,iH);
            ctx.restore();

            // Mouth open overlay
            const mo=Math.max(0,e.mouth-0.05);
            if(mo>0){
                ctx.save();
                ctx.translate(pivX+offX, iY+iH*0.72+offY); ctx.rotate(rr);
                ctx.beginPath(); ctx.ellipse(0,0,iW*0.10*(1+mo*0.3),iH*0.025*(1+mo*3.5),0,0,Math.PI*2);
                ctx.fillStyle='rgba(10,5,5,0.75)'; ctx.fill();
                ctx.restore();
            }

            // Blink overlays
            [[e.bL,-0.14],[e.bR,0.14]].forEach(([b,xf])=>{
                if(b<0.25) return;
                ctx.save();
                ctx.translate(pivX+iW*xf+offX, pivY-iH*0.035+offY); ctx.rotate(rr);
                ctx.beginPath(); ctx.ellipse(0,0,iW*0.09,iH*0.016*b*2.5,0,0,Math.PI*2);
                ctx.fillStyle='rgba(205,165,120,0.85)'; ctx.fill();
                ctx.restore();
            });

            // Accessory emoji
            if(acc!=='none'){
                const emap={glasses:'🕶️',crown:'👑',ears:'🐱'};
                const emoji=emap[acc];
                if(emoji){
                    ctx.save();
                    ctx.font=`${iW*0.25}px Arial`;
                    ctx.textAlign='center'; ctx.textBaseline='middle';
                    const ax=pivX+offX;
                    const ay=acc==='glasses'?(pivY-iH*0.04+offY):acc==='crown'?(iY+iH*0.06+offY):(iY+iH*0.07+offY);
                    ctx.translate(ax,ay); ctx.rotate(rr);
                    ctx.fillText(emoji,0,0);
                    ctx.restore();
                }
            }

            rafRef.current=requestAnimationFrame(draw);
        };

        rafRef.current=requestAnimationFrame(draw);
        return ()=>cancelAnimationFrame(rafRef.current);
    },[ready,acc,useAudio]);

    return html`
        <div ref=${contRef} style=${{width:'100%',height:'100%',position:'absolute',top:0,left:0}}>
            ${!ready && html`
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">画像を読み込み中...</div>
                </div>
            `}
            <canvas ref=${cvRef} id="avatar-canvas" style=${{width:'100%',height:'100%',display:ready?'block':'none'}}></canvas>
        </div>
    `;
}

// ══════════════ RECORDING ══════════════
function RecordCard({ isRec, setRec, recSec, setRecSec }) {
    const recRef=useRef(); const timerRef=useRef();
    const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    useEffect(()=>{ if(isRec){timerRef.current=setInterval(()=>setRecSec(p=>p+1),1000);}else{clearInterval(timerRef.current);setRecSec(0);} return ()=>clearInterval(timerRef.current); },[isRec]);
    const start=async()=>{
        const cv=document.getElementById('avatar-canvas'); if(!cv) return;
        const vs=cv.captureStream(30);
        const cm=new MediaStream([...vs.getVideoTracks()]);
        try{ const mic=await navigator.mediaDevices.getUserMedia({audio:true}); mic.getAudioTracks().forEach(t=>cm.addTrack(t)); }catch(_){}
        const rec=new MediaRecorder(cm); const chunks=[];
        rec.ondataavailable=e=>e.data.size>0&&chunks.push(e.data);
        rec.onstop=()=>{ const b=new Blob(chunks,{type:'video/webm'}); const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:`vtuber-${Date.now()}.webm`}); document.body.appendChild(a);a.click();a.remove(); };
        rec.start(1000); recRef.current=rec; setRec(true);
    };
    return html`
        <div class="panel-card">
            <h2>📹 録画・ダウンロード</h2>
            <div class="control-group">
                <p style=${{fontSize:'12px',color:'var(--text-muted)'}}>アバター画面とマイクをWebMで保存。</p>
                ${isRec&&html`<div class="recording-bar"><span class="recording-dot"></span><span>録画中: ${fmt(recSec)}</span></div>`}
                ${!isRec?html`<button class="btn btn-primary" onClick=${start}>🔴 録画開始</button>`:html`<button class="btn btn-danger" onClick=${()=>{recRef.current?.stop();setRec(false);}}>⏹ 停止して保存</button>`}
            </div>
        </div>
    `;
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
