export const generateProceduralAssetSheetDataUrl = (promptText: string): string => {
  const lowerPrompt = promptText.toLowerCase();

  // Extract Hair Color Palette
  let hairTop = '#f1f5f9';
  let hairBot = '#cbd5e1';
  let hairAccent = '#94a3b8';

  if (lowerPrompt.includes('pink') || lowerPrompt.includes('桃') || lowerPrompt.includes('ピンク')) {
    hairTop = '#fbcfe8'; hairBot = '#f472b6'; hairAccent = '#db2777';
  } else if (lowerPrompt.includes('black') || lowerPrompt.includes('黒')) {
    hairTop = '#475569'; hairBot = '#1e293b'; hairAccent = '#0f172a';
  } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金') || lowerPrompt.includes('ブロンド')) {
    hairTop = '#fef08a'; hairBot = '#facc15'; hairAccent = '#ca8a04';
  } else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) {
    hairTop = '#e9d5ff'; hairBot = '#c084fc'; hairAccent = '#9333ea';
  } else if (lowerPrompt.includes('blue') || lowerPrompt.includes('青') || lowerPrompt.includes('水')) {
    hairTop = '#bae6fd'; hairBot = '#38bdf8'; hairAccent = '#0284c7';
  } else if (lowerPrompt.includes('red') || lowerPrompt.includes('赤')) {
    hairTop = '#fca5a5'; hairBot = '#f87171'; hairAccent = '#dc2626';
  }

  // Extract Eye Color Palette
  let irisTop = '#312e81';
  let irisMid = '#4338ca';
  let irisBot = '#818cf8';

  if (lowerPrompt.includes('red') || lowerPrompt.includes('赤') || lowerPrompt.includes('crimson')) {
    irisTop = '#450a0a'; irisMid = '#991b1b'; irisBot = '#f87171';
  } else if (lowerPrompt.includes('green') || lowerPrompt.includes('緑')) {
    irisTop = '#052e16'; irisMid = '#15803d'; irisBot = '#4ade80';
  } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金')) {
    irisTop = '#451a03'; irisMid = '#b45309'; irisBot = '#fbbf24';
  } else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) {
    irisTop = '#3b0764'; irisMid = '#7e22ce'; irisBot = '#c084fc';
  }

  // Outfit Palette
  let outfitMain = '#4f46e5';
  let outfitSub = '#ffffff';
  let outfitRibbon = '#f43f5e';

  if (lowerPrompt.includes('gothic') || lowerPrompt.includes('black') || lowerPrompt.includes('ゴシック') || lowerPrompt.includes('ゴス')) {
    outfitMain = '#1e1b4b'; outfitSub = '#312e81'; outfitRibbon = '#991b1b';
  } else if (lowerPrompt.includes('miko') || lowerPrompt.includes('shrine') || lowerPrompt.includes('巫女')) {
    outfitMain = '#dc2626'; outfitSub = '#ffffff'; outfitRibbon = '#facc15';
  } else if (lowerPrompt.includes('cyberpunk') || lowerPrompt.includes('neon') || lowerPrompt.includes('サイバー')) {
    outfitMain = '#0284c7'; outfitSub = '#0f172a'; outfitRibbon = '#ec4899';
  } else if (lowerPrompt.includes('maid') || lowerPrompt.includes('メイド')) {
    outfitMain = '#0f172a'; outfitSub = '#f8fafc'; outfitRibbon = '#f43f5e';
  }

  const hasCatEars = lowerPrompt.includes('cat') || lowerPrompt.includes('猫') || lowerPrompt.includes('ねこ') || lowerPrompt.includes('耳');
  const hasFoxEars = lowerPrompt.includes('fox') || lowerPrompt.includes('狐') || lowerPrompt.includes('きつね');

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <!-- Gradients -->
      <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${hairTop}" />
        <stop offset="70%" stop-color="${hairBot}" />
        <stop offset="100%" stop-color="${hairAccent}" />
      </linearGradient>

      <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff5f0" />
        <stop offset="100%" stop-color="#ffe4d6" />
      </linearGradient>

      <linearGradient id="irisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${irisTop}" />
        <stop offset="50%" stop-color="${irisMid}" />
        <stop offset="100%" stop-color="${irisBot}" />
      </linearGradient>

      <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff9ebb" stop-opacity="0.65" />
        <stop offset="100%" stop-color="#ff9ebb" stop-opacity="0" />
      </radialGradient>

      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <rect width="1280" height="720" fill="#ffffff" />
    <line x1="640" y1="0" x2="640" y2="720" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 8" />

    <!-- LEFT HALF: BLANK FACE BUST (CHEST UP) -->
    <g id="left-bust">
      <!-- Back Hair (Twintails / Long Hair) -->
      <path d="M 170 320 Q 110 500 130 680 C 180 700 230 600 220 480 Z" fill="url(#hairGrad)" />
      <path d="M 470 320 Q 530 500 510 680 C 460 700 410 600 420 480 Z" fill="url(#hairGrad)" />

      <!-- Outfit (Chest up) -->
      <path d="M 160 720 C 160 520, 240 480, 320 480 C 400 480, 480 520, 480 720 Z" fill="${outfitMain}" stroke="#1e1b4b" stroke-width="3" />
      <path d="M 260 480 L 320 550 L 380 480 Z" fill="${outfitSub}" stroke="#1e1b4b" stroke-width="2" />
      <polygon points="320,535 295,580 345,580" fill="${outfitRibbon}" stroke="#1e1b4b" stroke-width="2" />
      <circle cx="320" cy="535" r="8" fill="#fbbf24" stroke="#1e1b4b" stroke-width="2" />

      <!-- Neck & Collar Shadow -->
      <rect x="295" y="360" width="50" height="130" fill="url(#skinGrad)" rx="10" />
      <path d="M 295 410 Q 320 435 345 410" fill="none" stroke="#f4a261" stroke-width="4" opacity="0.5" stroke-linecap="round" />

      <!-- Ears (Cat / Fox) -->
      ${hasCatEars || hasFoxEars ? `
        <g stroke="#2a2038" stroke-width="3" stroke-linejoin="round">
          <polygon points="210,190 150,70 260,140" fill="url(#hairGrad)" />
          <polygon points="215,180 165,90 250,145" fill="#ffaab8" />
          <polygon points="430,190 490,70 380,140" fill="url(#hairGrad)" />
          <polygon points="425,180 475,90 390,145" fill="#ffaab8" />
        </g>
      ` : ''}

      <!-- Blank Face Base (Smooth Anime Skin Contour) -->
      <path d="M 210 240 C 210 130 430 130 430 240 C 430 350 370 410 320 410 C 270 410 210 350 210 240 Z" fill="url(#skinGrad)" stroke="#2a2038" stroke-width="3" />

      <!-- Hair Bangs (Multi-strand Anime Layering) -->
      <path d="M 200 220 Q 230 310 255 240 Q 285 330 315 240 Q 345 330 375 240 Q 405 310 440 220 Q 320 100 200 220 Z" fill="url(#hairGrad)" stroke="#2a2038" stroke-width="3" stroke-linejoin="round" />
      <path d="M 210 200 Q 320 120 430 200" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.6" stroke-linecap="round" />

      <!-- Blush Cheeks -->
      <ellipse cx="255" cy="315" rx="25" ry="14" fill="url(#blushGrad)" />
      <ellipse cx="385" cy="315" rx="25" ry="14" fill="url(#blushGrad)" />
      
      <!-- Subtle Nose Dot -->
      <circle cx="320" cy="335" r="2" fill="#d97706" opacity="0.6" />
    </g>

    <!-- RIGHT HALF: ORGANIZED EXPRESSION PARTS (2x2 Grid) -->

    <!-- Quadrant 1: Both Eyes Open (Top-Left of Right Half: X 640..960, Y 0..360) -->
    <g id="eyes-open" transform="translate(670, 110)">
      <!-- Left Eye -->
      <g>
        <ellipse cx="70" cy="65" rx="36" ry="44" fill="#0f172a" />
        <ellipse cx="70" cy="65" rx="30" ry="38" fill="url(#irisGrad)" />
        <circle cx="70" cy="72" r="16" fill="${irisBot}" />
        <ellipse cx="60" cy="48" rx="12" ry="15" fill="#ffffff" />
        <circle cx="82" cy="78" r="6" fill="#ffffff" />
        <!-- Eyelash Line & Wing -->
        <path d="M 25 55 C 35 25, 105 25, 115 55" fill="none" stroke="#1e1b4b" stroke-width="8" stroke-linecap="round" />
        <path d="M 105 50 L 122 42" stroke="#1e1b4b" stroke-width="6" stroke-linecap="round" />
        <path d="M 28 65 Q 70 88 112 65" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" />
        <!-- Eyebrow -->
        <path d="M 30 20 Q 70 5 110 25" fill="none" stroke="${hairAccent}" stroke-width="5" stroke-linecap="round" />
      </g>

      <!-- Right Eye -->
      <g>
        <ellipse cx="190" cy="65" rx="36" ry="44" fill="#0f172a" />
        <ellipse cx="190" cy="65" rx="30" ry="38" fill="url(#irisGrad)" />
        <circle cx="190" cy="72" r="16" fill="${irisBot}" />
        <ellipse cx="180" cy="48" rx="12" ry="15" fill="#ffffff" />
        <circle cx="202" cy="78" r="6" fill="#ffffff" />
        <!-- Eyelash Line & Wing -->
        <path d="M 145 55 C 155 25, 225 25, 235 55" fill="none" stroke="#1e1b4b" stroke-width="8" stroke-linecap="round" />
        <path d="M 225 50 L 242 42" stroke="#1e1b4b" stroke-width="6" stroke-linecap="round" />
        <path d="M 148 65 Q 190 88 232 65" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" />
        <!-- Eyebrow -->
        <path d="M 150 25 Q 190 5 230 20" fill="none" stroke="${hairAccent}" stroke-width="5" stroke-linecap="round" />
      </g>
    </g>

    <!-- Quadrant 2: Both Eyes Closed (Top-Right of Right Half: X 960..1280, Y 0..360) -->
    <g id="eyes-closed" transform="translate(990, 110)">
      <!-- Left Closed Eye (^ Happy Curve) -->
      <g>
        <path d="M 25 65 Q 70 25 115 65" fill="none" stroke="#1e1b4b" stroke-width="9" stroke-linecap="round" />
        <path d="M 35 70 Q 70 40 105 70" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" />
        <path d="M 105 60 L 122 52" stroke="#1e1b4b" stroke-width="6" stroke-linecap="round" />
        <path d="M 30 20 Q 70 5 110 25" fill="none" stroke="${hairAccent}" stroke-width="5" stroke-linecap="round" />
      </g>

      <!-- Right Closed Eye -->
      <g>
        <path d="M 145 65 Q 190 25 235 65" fill="none" stroke="#1e1b4b" stroke-width="9" stroke-linecap="round" />
        <path d="M 155 70 Q 190 40 225 70" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" />
        <path d="M 225 60 L 242 52" stroke="#1e1b4b" stroke-width="6" stroke-linecap="round" />
        <path d="M 150 25 Q 190 5 230 20" fill="none" stroke="${hairAccent}" stroke-width="5" stroke-linecap="round" />
      </g>
    </g>

    <!-- Quadrant 3: Mouth Open (Bottom-Left of Right Half: X 640..960, Y 360..720) -->
    <g id="mouth-open" transform="translate(730, 470)">
      <path d="M 15 20 Q 70 100 125 20 Z" fill="#881337" stroke="#1e1b4b" stroke-width="5" stroke-linejoin="round" />
      <!-- Teeth Upper -->
      <path d="M 30 22 Q 70 38 110 22 L 110 32 Q 70 45 30 32 Z" fill="#ffffff" />
      <!-- Cute Pink Tongue -->
      <path d="M 40 65 Q 70 40 100 65 Q 70 92 40 65 Z" fill="#fb7185" />
    </g>

    <!-- Quadrant 4: Mouth Neutral (Bottom-Right of Right Half: X 960..1280, Y 360..720) -->
    <g id="mouth-neutral" transform="translate(1050, 470)">
      <path d="M 15 45 Q 70 56 125 45" fill="none" stroke="#1e1b4b" stroke-width="8" stroke-linecap="round" />
      <path d="M 55 52 Q 70 60 85 52" fill="none" stroke="#9f1239" stroke-width="4" stroke-linecap="round" />
    </g>
  </svg>`;

  const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${base64Svg}`;
};
