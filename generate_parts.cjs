const fs = require('fs');
const path = require('path');

const partsDir = path.join(__dirname, 'public', 'parts');
if (!fs.existsSync(partsDir)) {
  fs.mkdirSync(partsDir, { recursive: true });
}

// Helper to write SVG
const writeSvg = (filename, content) => {
  fs.writeFileSync(path.join(partsDir, filename), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${content}\n</svg>`);
};

// 1. Anime Tsuri Eye (Closed) - sharp, outer corner rises
// Upper lid curves DOWN from inner to outer, outer corner lash flicks up
writeSvg('eye_anime_tsuri.svg', `
  <!-- Main eyelid line: curves downward in center, up at outer corner = natural -->
  <path d="M 8,42 Q 50,68 90,30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
  <!-- Lash flicks at outer corner -->
  <path d="M 83,34 Q 92,22 98,28" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
  <path d="M 78,30 Q 86,18 90,22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
`);

// 2. Anime Tare Eye (Closed) - gentle droopy look
writeSvg('eye_anime_tare.svg', `
  <!-- Main eyelid line: gentle downward arc, outer end drops slightly -->
  <path d="M 8,38 Q 50,62 90,52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
  <!-- Soft lash at outer corner -->
  <path d="M 83,55 Q 90,65 96,60" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
`);

// 3. Realistic/Thin Eye (Closed) - very subtle line
writeSvg('eye_real_thin.svg', `
  <!-- Subtle, near-flat line with slight downward sag -->
  <path d="M 12,48 Q 50,56 88,48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
`);

// 4. Cool/Straight Eye (Closed)
writeSvg('eye_cool_straight.svg', `
  <!-- Nearly flat line, very slight outward drop -->
  <path d="M 10,50 Q 50,52 90,46" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
`);

// --- Mouths ---

// 1. Anime Small Smile (Open)
writeSvg('mouth_anime_smile_open.svg', `
  <path d="M 20,40 Q 50,60 80,40 Q 50,80 20,40" fill="var(--mouth-bg, #661111)" />
  <path d="M 20,40 Q 50,60 80,40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
  <path d="M 35,60 Q 50,75 65,60 Q 50,55 35,60" fill="var(--tongue-color, #ff6666)" />
`);

// 2. Anime Big Smile / Laugh (Open)
writeSvg('mouth_anime_laugh_open.svg', `
  <path d="M 10,30 L 90,30 Q 50,100 10,30" fill="var(--mouth-bg, #661111)" />
  <path d="M 10,30 L 90,30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
  <path d="M 25,65 Q 50,90 75,65 Q 50,60 25,65" fill="var(--tongue-color, #ff6666)" />
  <!-- Fangs -->
  <path d="M 15,30 L 25,30 L 20,45 Z" fill="#ffffff" />
  <path d="M 75,30 L 85,30 L 80,45 Z" fill="#ffffff" />
`);

// 3. Cute Cat Mouth (Open)
writeSvg('mouth_cat_open.svg', `
  <path d="M 20,40 Q 35,50 50,40 Q 65,50 80,40 Q 50,70 20,40" fill="var(--mouth-bg, #661111)" />
  <path d="M 20,40 Q 35,50 50,40 Q 65,50 80,40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
`);

// 4. Realistic/Subtle Mouth (Open)
writeSvg('mouth_real_open.svg', `
  <path d="M 25,50 Q 50,60 75,50 Q 50,70 25,50" fill="var(--mouth-bg, #441111)" />
  <path d="M 25,50 Q 50,55 75,50" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  <!-- Lips -->
  <path d="M 30,50 Q 50,45 70,50" fill="none" stroke="#e09090" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
  <path d="M 30,60 Q 50,75 70,60" fill="none" stroke="#e09090" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
`);

// 5. Surprised/Circle Mouth (Open)
writeSvg('mouth_surprised_open.svg', `
  <ellipse cx="50" cy="50" rx="20" ry="30" fill="var(--mouth-bg, #441111)" stroke="currentColor" stroke-width="4" />
`);

const library = {
  eyes: [
    { id: "eye_anime_tsuri", file: "eye_anime_tsuri.svg", name: "アニメ風 ツリ目", description: "Lashes angled upwards, energetic or sharp look." },
    { id: "eye_anime_tare", file: "eye_anime_tare.svg", name: "アニメ風 タレ目", description: "Lashes angled downwards, gentle or sleepy look." },
    { id: "eye_real_thin", file: "eye_real_thin.svg", name: "リアル系 細目", description: "Subtle, thin lash line, suitable for realistic or mature characters." },
    { id: "eye_cool_straight", file: "eye_cool_straight.svg", name: "クール 直線", description: "Straight horizontal line, emotionless or very cool look." }
  ],
  mouths: [
    { id: "mouth_anime_smile_open", file: "mouth_anime_smile_open.svg", name: "アニメ風 笑顔(小)", description: "Standard anime smile, slightly open with tongue." },
    { id: "mouth_anime_laugh_open", file: "mouth_anime_laugh_open.svg", name: "アニメ風 大笑い(キバ)", description: "Wide open D-shaped mouth with small fangs." },
    { id: "mouth_cat_open", file: "mouth_cat_open.svg", name: "猫口", description: "W-shaped upper lip, cute cat-like open mouth." },
    { id: "mouth_real_open", file: "mouth_real_open.svg", name: "リアル系 開口", description: "Subtle opening with realistic lip shading." },
    { id: "mouth_surprised_open", file: "mouth_surprised_open.svg", name: "驚き (O型)", description: "Vertical oval shape, surprised or shouting." }
  ]
};

fs.writeFileSync(path.join(partsDir, 'library.json'), JSON.stringify(library, null, 2));
console.log('Parts generated in public/parts!');
