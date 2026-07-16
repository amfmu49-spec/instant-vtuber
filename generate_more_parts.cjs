const fs = require('fs');
const path = require('path');
const partsDir = path.join(process.cwd(), 'public', 'parts');
if (!fs.existsSync(partsDir)) fs.mkdirSync(partsDir, { recursive: true });

const writeSvg = (filename, content) => {
  fs.writeFileSync(path.join(partsDir, filename), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${content}\n</svg>`);
};

// Eyes
writeSvg('eye_anime_tsuri.svg', '<path d="M 8,42 Q 50,68 90,30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" /><path d="M 83,34 Q 92,22 98,28" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><path d="M 78,30 Q 86,18 90,22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />');
writeSvg('eye_anime_tare.svg', '<path d="M 8,38 Q 50,62 90,52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" /><path d="M 83,55 Q 90,65 96,60" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />');
writeSvg('eye_real_thin.svg', '<path d="M 12,48 Q 50,56 88,48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />');
writeSvg('eye_cool_straight.svg', '<path d="M 10,50 Q 50,52 90,46" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />');
writeSvg('eye_anime_angry.svg', '<path d="M 10,20 L 90,60" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />');
writeSvg('eye_anime_sad.svg', '<path d="M 10,60 L 90,20" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap=\"round\" />');
writeSvg('eye_anime_wide.svg', '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="6" /><circle cx="50" cy="50" r="10" fill="currentColor" />');
writeSvg('eye_anime_heart.svg', '<path d="M 50,30 A 20,20 0 0,0 10,50 Q 10,70 50,90 Q 90,70 90,50 A 20,20 0 0,0 50,30" fill="currentColor" />');
writeSvg('eye_anime_star.svg', '<polygon points="50,10 61,39 92,39 67,57 76,86 50,69 24,86 33,57 8,39 39,39" fill="currentColor" />');
writeSvg('eye_dot.svg', '<circle cx="50" cy="50" r="8" fill="currentColor" />');
writeSvg('eye_line.svg', '<path d="M 20,50 L 80,50" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />');
writeSvg('eye_cross.svg', '<path d="M 30,30 L 70,70 M 70,30 L 30,70" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />');
writeSvg('eye_spiral.svg', '<path d="M 50,50 m 0,-30 a 30,30 0 1,1 0,60 a 20,20 0 1,1 0,-40 a 10,10 0 1,1 0,20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />');
writeSvg('eye_sparkle.svg', '<path d="M 50,10 L 60,40 L 90,50 L 60,60 L 50,90 L 40,60 L 10,50 L 40,40 Z" fill="currentColor" />');

// Mouths
writeSvg('mouth_anime_smile_open.svg', '<path d="M 20,40 Q 50,60 80,40 Q 50,80 20,40" fill="var(--mouth-bg, #661111)" /><path d="M 20,40 Q 50,60 80,40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><path d="M 35,60 Q 50,75 65,60 Q 50,55 35,60" fill="var(--tongue-color, #ff6666)" />');
writeSvg('mouth_anime_laugh_open.svg', '<path d="M 10,30 L 90,30 Q 50,100 10,30" fill="var(--mouth-bg, #661111)" /><path d="M 10,30 L 90,30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" /><path d="M 25,65 Q 50,90 75,65 Q 50,60 25,65" fill="var(--tongue-color, #ff6666)" /><path d="M 15,30 L 25,30 L 20,45 Z" fill="#ffffff" /><path d="M 75,30 L 85,30 L 80,45 Z" fill="#ffffff" />');
writeSvg('mouth_cat_open.svg', '<path d="M 20,40 Q 35,50 50,40 Q 65,50 80,40 Q 50,70 20,40" fill="var(--mouth-bg, #661111)" /><path d="M 20,40 Q 35,50 50,40 Q 65,50 80,40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />');
writeSvg('mouth_real_open.svg', '<path d="M 25,50 Q 50,60 75,50 Q 50,70 25,50" fill="var(--mouth-bg, #441111)" /><path d="M 25,50 Q 50,55 75,50" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /><path d="M 30,50 Q 50,45 70,50" fill="none" stroke="#e09090" stroke-width="3" stroke-linecap="round" opacity="0.6"/><path d="M 30,60 Q 50,75 70,60" fill="none" stroke="#e09090" stroke-width="4" stroke-linecap="round" opacity="0.6"/>');
writeSvg('mouth_surprised_open.svg', '<ellipse cx="50" cy="50" rx="20" ry="30" fill="var(--mouth-bg, #441111)" stroke="currentColor" stroke-width="4" />');
writeSvg('mouth_anime_angry.svg', '<path d="M 20,60 Q 50,40 80,60 Q 50,80 20,60" fill="var(--mouth-bg, #661111)" /><path d="M 20,60 Q 50,40 80,60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />');
writeSvg('mouth_anime_sad.svg', '<path d="M 20,70 Q 50,30 80,70" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />');
writeSvg('mouth_anime_triangle.svg', '<polygon points="20,30 80,30 50,80" fill="var(--mouth-bg, #661111)" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />');
writeSvg('mouth_anime_w.svg', '<path d="M 20,40 Q 35,70 50,40 Q 65,70 80,40" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />');
writeSvg('mouth_anime_pout.svg', '<path d="M 40,60 Q 50,50 60,60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />');
writeSvg('mouth_anime_v.svg', '<path d="M 30,30 L 50,70 L 70,30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />');
writeSvg('mouth_animal_bird.svg', '<polygon points="20,40 80,40 50,70" fill="#f59e0b" stroke="#d97706" stroke-width="3" stroke-linejoin="round" /><line x1="20" y1="40" x2="80" y2="40" stroke="#d97706" stroke-width="2" />');

const library = {
  eyes: [
    { id: "eye_anime_tsuri", file: "eye_anime_tsuri.svg", name: "アニメ風 ツリ目" },
    { id: "eye_anime_tare", file: "eye_anime_tare.svg", name: "アニメ風 タレ目" },
    { id: "eye_real_thin", file: "eye_real_thin.svg", name: "リアル系 細目" },
    { id: "eye_cool_straight", file: "eye_cool_straight.svg", name: "クール 直線" },
    { id: "eye_anime_angry", file: "eye_anime_angry.svg", name: "怒り目" },
    { id: "eye_anime_sad", file: "eye_anime_sad.svg", name: "悲しみ目" },
    { id: "eye_anime_wide", file: "eye_anime_wide.svg", name: "見開き目" },
    { id: "eye_anime_heart", file: "eye_anime_heart.svg", name: "ハート目" },
    { id: "eye_anime_star", file: "eye_anime_star.svg", name: "星目" },
    { id: "eye_dot", file: "eye_dot.svg", name: "点目" },
    { id: "eye_line", file: "eye_line.svg", name: "ジト目 (線)" },
    { id: "eye_cross", file: "eye_cross.svg", name: "バツ目 (>_<)" },
    { id: "eye_spiral", file: "eye_spiral.svg", name: "ぐるぐる目" },
    { id: "eye_sparkle", file: "eye_sparkle.svg", name: "キラキラ目" }
  ],
  mouths: [
    { id: "mouth_anime_smile_open", file: "mouth_anime_smile_open.svg", name: "アニメ風 笑顔" },
    { id: "mouth_anime_laugh_open", file: "mouth_anime_laugh_open.svg", name: "アニメ風 大笑い(キバ)" },
    { id: "mouth_cat_open", file: "mouth_cat_open.svg", name: "猫口" },
    { id: "mouth_real_open", file: "mouth_real_open.svg", name: "リアル系 開口" },
    { id: "mouth_surprised_open", file: "mouth_surprised_open.svg", name: "驚き (O型)" },
    { id: "mouth_anime_angry", file: "mouth_anime_angry.svg", name: "怒り口" },
    { id: "mouth_anime_sad", file: "mouth_anime_sad.svg", name: "への字口" },
    { id: "mouth_anime_triangle", file: "mouth_anime_triangle.svg", name: "三角口" },
    { id: "mouth_anime_w", file: "mouth_anime_w.svg", name: "ω口 (閉じ)" },
    { id: "mouth_anime_pout", file: "mouth_anime_pout.svg", name: "むくれ口" },
    { id: "mouth_anime_v", file: "mouth_anime_v.svg", name: "V字口" },
    { id: "mouth_animal_bird", file: "mouth_animal_bird.svg", name: "鳥のくちばし" }
  ]
};
fs.writeFileSync(path.join(partsDir, 'library.json'), JSON.stringify(library, null, 2));
console.log('Done!');
