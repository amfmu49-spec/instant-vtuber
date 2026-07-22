export const createSample16by9AssetSheetDataUrl = (): string => {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <!-- Background -->
    <rect width="1280" height="720" fill="#ffffff" />

    <!-- Subtle vertical divider (visual aid for 16:9 halves) -->
    <line x1="640" y1="0" x2="640" y2="720" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="8 8" />

    <!-- LEFT HALF: BLANK FACE ANIME CHARACTER BUST (Chest up) -->
    <g id="left-bust">
      <!-- Shoulders & Outfit -->
      <path d="M 160 720 C 160 520, 240 480, 320 480 C 400 480, 480 520, 480 720 Z" fill="#6366f1" />
      <!-- Collar & Ribbon -->
      <path d="M 270 480 L 320 540 L 370 480 Z" fill="#ffffff" />
      <polygon points="320,530 300,570 340,570" fill="#ec4899" />

      <!-- Neck -->
      <rect x="295" y="360" width="50" height="130" fill="#ffe0d0" rx="10" />
      <path d="M 295 400 Q 320 420 345 400" fill="none" stroke="#f4a261" stroke-width="3" opacity="0.4" />

      <!-- Back Hair -->
      <path d="M 180 320 C 160 100, 480 100, 460 320 L 490 600 C 490 600, 430 620, 420 500 L 220 500 C 210 620, 150 600, 150 600 Z" fill="#cbd5e1" />

      <!-- Head Base (Blank Smooth Skin Face) -->
      <ellipse cx="320" cy="270" rx="110" ry="130" fill="#ffe0d0" />
      <path d="M 210 260 Q 320 400 430 260 Z" fill="#ffe0d0" />

      <!-- Ear details -->
      <ellipse cx="205" cy="270" rx="15" ry="25" fill="#ffd0bc" />
      <ellipse cx="435" cy="270" rx="15" ry="25" fill="#ffd0bc" />

      <!-- Front Bangs Hair -->
      <path d="M 210 200 Q 250 280 270 230 Q 300 300 320 230 Q 350 300 370 230 Q 390 280 430 200 Q 320 120 210 200 Z" fill="#e2e8f0" />
      <path d="M 210 200 Q 320 130 430 200" fill="none" stroke="#94a3b8" stroke-width="3" />
      
      <!-- Cheeks Blush -->
      <ellipse cx="255" cy="300" rx="20" ry="10" fill="#ffb3ba" opacity="0.5" />
      <ellipse cx="385" cy="300" rx="20" ry="10" fill="#ffb3ba" opacity="0.5" />
    </g>

    <!-- RIGHT HALF: EXPRESSION PARTS (2x2 Grid) -->

    <!-- Quadrant 1: Both Eyes Open (Top-Left of Right Half: X 640..960, Y 0..360) -->
    <g id="eyes-open" transform="translate(670, 120)">
      <!-- Left Eye -->
      <ellipse cx="70" cy="60" rx="35" ry="40" fill="#1e1b4b" />
      <ellipse cx="70" cy="60" rx="28" ry="32" fill="#4338ca" />
      <circle cx="70" cy="65" r="16" fill="#818cf8" />
      <circle cx="60" cy="45" r="10" fill="#ffffff" />
      <circle cx="78" cy="72" r="5" fill="#ffffff" />
      <!-- Eyelash -->
      <path d="M 30 50 Q 70 20 110 50" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />

      <!-- Right Eye -->
      <ellipse cx="190" cy="60" rx="35" ry="40" fill="#1e1b4b" />
      <ellipse cx="190" cy="60" rx="28" ry="32" fill="#4338ca" />
      <circle cx="190" cy="65" r="16" fill="#818cf8" />
      <circle cx="180" cy="45" r="10" fill="#ffffff" />
      <circle cx="198" cy="72" r="5" fill="#ffffff" />
      <!-- Eyelash -->
      <path d="M 150 50 Q 190 20 230 50" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />
    </g>

    <!-- Quadrant 2: Both Eyes Closed (Top-Right of Right Half: X 960..1280, Y 0..360) -->
    <g id="eyes-closed" transform="translate(990, 120)">
      <!-- Left Closed Eye (^ shape) -->
      <path d="M 30 65 Q 70 30 110 65" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" />
      <path d="M 40 68 Q 70 45 100 68" fill="none" stroke="#334155" stroke-width="4" />

      <!-- Right Closed Eye (^ shape) -->
      <path d="M 150 65 Q 190 30 230 65" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" />
      <path d="M 160 68 Q 190 45 220 68" fill="none" stroke="#334155" stroke-width="4" />
    </g>

    <!-- Quadrant 3: Mouth Open (Bottom-Left of Right Half: X 640..960, Y 360..720) -->
    <g id="mouth-open" transform="translate(730, 480)">
      <path d="M 20 20 Q 70 90 120 20 Z" fill="#991b1b" stroke="#0f172a" stroke-width="5" stroke-linejoin="round" />
      <!-- Teeth -->
      <path d="M 35 23 Q 70 35 105 23 L 105 32 Q 70 42 35 32 Z" fill="#ffffff" />
      <!-- Tongue -->
      <path d="M 45 60 Q 70 35 95 60 Q 70 85 45 60 Z" fill="#f43f5e" />
    </g>

    <!-- Quadrant 4: Mouth Neutral (Bottom-Right of Right Half: X 960..1280, Y 360..720) -->
    <g id="mouth-neutral" transform="translate(1050, 480)">
      <path d="M 20 40 Q 70 48 120 40" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />
      <path d="M 60 46 Q 70 52 80 46" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round" />
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};
