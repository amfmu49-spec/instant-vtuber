export const generateProceduralAssetSheetDataUrl = (promptText: string): string => {
  const lowerPrompt = promptText.toLowerCase();

  // Extract Hair Color
  let hairColor = '#e2e8f0'; // Default silver/light gray
  if (lowerPrompt.includes('pink') || lowerPrompt.includes('桃') || lowerPrompt.includes('ピンク')) hairColor = '#f472b6';
  else if (lowerPrompt.includes('black') || lowerPrompt.includes('黒')) hairColor = '#334155';
  else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金')) hairColor = '#facc15';
  else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) hairColor = '#c084fc';
  else if (lowerPrompt.includes('blue') || lowerPrompt.includes('青')) hairColor = '#60a5fa';
  else if (lowerPrompt.includes('red') || lowerPrompt.includes('赤')) hairColor = '#f87171';
  else if (lowerPrompt.includes('silver') || lowerPrompt.includes('銀')) hairColor = '#e2e8f0';

  // Extract Eye Color
  let eyeColor = '#4338ca'; // Default deep blue
  let eyeHighlight = '#818cf8';
  if (lowerPrompt.includes('red') || lowerPrompt.includes('赤') || lowerPrompt.includes('crimson')) {
    eyeColor = '#991b1b'; eyeHighlight = '#f87171';
  } else if (lowerPrompt.includes('green') || lowerPrompt.includes('緑')) {
    eyeColor = '#15803d'; eyeHighlight = '#4ade80';
  } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('yellow') || lowerPrompt.includes('金')) {
    eyeColor = '#b45309'; eyeHighlight = '#fbbf24';
  } else if (lowerPrompt.includes('purple') || lowerPrompt.includes('紫')) {
    eyeColor = '#6b21a8'; eyeHighlight = '#c084fc';
  }

  // Extract Outfit Color & Style
  let outfitColor = '#6366f1';
  let accentColor = '#ec4899';
  if (lowerPrompt.includes('gothic') || lowerPrompt.includes('black') || lowerPrompt.includes('ゴシック')) {
    outfitColor = '#1e293b'; accentColor = '#991b1b';
  } else if (lowerPrompt.includes('miko') || lowerPrompt.includes('shrine') || lowerPrompt.includes('巫女')) {
    outfitColor = '#dc2626'; accentColor = '#ffffff';
  } else if (lowerPrompt.includes('cyberpunk') || lowerPrompt.includes('neon') || lowerPrompt.includes('サイバー')) {
    outfitColor = '#0284c7'; accentColor = '#f43f5e';
  } else if (lowerPrompt.includes('maid') || lowerPrompt.includes('メイド')) {
    outfitColor = '#0f172a'; accentColor = '#ffffff';
  }

  const hasCatEars = lowerPrompt.includes('cat') || lowerPrompt.includes('猫') || lowerPrompt.includes('ねこ') || lowerPrompt.includes('耳');
  const hasFoxEars = lowerPrompt.includes('fox') || lowerPrompt.includes('狐');

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff" />
    <line x1="640" y1="0" x2="640" y2="720" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="8 8" />

    <!-- LEFT HALF: BLANK FACE BUST -->
    <g id="left-bust">
      <!-- Outfit -->
      <path d="M 160 720 C 160 520, 240 480, 320 480 C 400 480, 480 520, 480 720 Z" fill="${outfitColor}" />
      <path d="M 270 480 L 320 540 L 370 480 Z" fill="#ffffff" />
      <polygon points="320,530 300,570 340,570" fill="${accentColor}" />

      <!-- Neck -->
      <rect x="295" y="360" width="50" height="130" fill="#ffe0d0" rx="10" />

      <!-- Back Hair -->
      <path d="M 180 320 C 160 100, 480 100, 460 320 L 490 600 C 490 600, 430 620, 420 500 L 220 500 C 210 620, 150 600, 150 600 Z" fill="${hairColor}" opacity="0.85" />

      <!-- Ears (Cat / Fox) -->
      ${hasCatEars || hasFoxEars ? `
        <polygon points="210,190 170,90 260,150" fill="${hairColor}" />
        <polygon points="215,185 185,105 250,155" fill="#ffaab8" />
        <polygon points="430,190 470,90 380,150" fill="${hairColor}" />
        <polygon points="425,185 455,105 390,155" fill="#ffaab8" />
      ` : ''}

      <!-- Blank Face Base -->
      <ellipse cx="320" cy="270" rx="110" ry="130" fill="#ffe0d0" />
      <path d="M 210 260 Q 320 400 430 260 Z" fill="#ffe0d0" />

      <!-- Bangs -->
      <path d="M 210 200 Q 250 280 270 230 Q 300 300 320 230 Q 350 300 370 230 Q 390 280 430 200 Q 320 120 210 200 Z" fill="${hairColor}" />
      <ellipse cx="255" cy="300" rx="20" ry="10" fill="#ffb3ba" opacity="0.5" />
      <ellipse cx="385" cy="300" rx="20" ry="10" fill="#ffb3ba" opacity="0.5" />
    </g>

    <!-- RIGHT HALF: EXPRESSION PARTS -->
    <!-- Eyes Open -->
    <g transform="translate(670, 120)">
      <ellipse cx="70" cy="60" rx="35" ry="40" fill="#1e1b4b" />
      <ellipse cx="70" cy="60" rx="28" ry="32" fill="${eyeColor}" />
      <circle cx="70" cy="65" r="16" fill="${eyeHighlight}" />
      <circle cx="60" cy="45" r="10" fill="#ffffff" />
      <path d="M 30 50 Q 70 20 110 50" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />

      <ellipse cx="190" cy="60" rx="35" ry="40" fill="#1e1b4b" />
      <ellipse cx="190" cy="60" rx="28" ry="32" fill="${eyeColor}" />
      <circle cx="190" cy="65" r="16" fill="${eyeHighlight}" />
      <circle cx="180" cy="45" r="10" fill="#ffffff" />
      <path d="M 150 50 Q 190 20 230 50" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />
    </g>

    <!-- Eyes Closed -->
    <g transform="translate(990, 120)">
      <path d="M 30 65 Q 70 30 110 65" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" />
      <path d="M 150 65 Q 190 30 230 65" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" />
    </g>

    <!-- Mouth Open -->
    <g transform="translate(730, 480)">
      <path d="M 20 20 Q 70 90 120 20 Z" fill="#991b1b" stroke="#0f172a" stroke-width="5" stroke-linejoin="round" />
      <path d="M 35 23 Q 70 35 105 23 L 105 32 Q 70 42 35 32 Z" fill="#ffffff" />
      <path d="M 45 60 Q 70 35 95 60 Q 70 85 45 60 Z" fill="#f43f5e" />
    </g>

    <!-- Mouth Neutral -->
    <g transform="translate(1050, 480)">
      <path d="M 20 40 Q 70 48 120 40" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};
