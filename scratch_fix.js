const fs = require('fs');
const path = 'C:\\Users\\evoli\\.gemini\\antigravity-ide\\scratch\\vtuber-app\\src\\components\\MainScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the mouth draw block to draw directly without aspect ratio preservation and prevent ReferenceError on aAspect
const target = `                if (assetMouth) {
                    const bAspect = mw / mh;
                    let dw = mw;
                    let dh = mh;
                    if (bAspect > aAspect) {
                      dw = mh * aAspect;
                    } else {
                      dh = mw / aAspect;
                    }
                    ctx.drawImage(assetMouth, -dw/2, -dh/2, dw, dh);
                }`;

const replacement = `                if (assetMouth) {
                    ctx.drawImage(assetMouth, -mw/2, -mh/2, mw, mh);
                }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('SUCCESS: Replaced with standard LF/CRLF');
} else {
    // Try with normalized LF
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedTarget = target.replace(/\r\n/g, '\n');
    const normalizedReplacement = replacement.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(normalizedTarget)) {
        const result = normalizedContent.replace(normalizedTarget, normalizedReplacement);
        // Save back with CRLF
        fs.writeFileSync(path, result.replace(/\n/g, '\r\n'), 'utf8');
        console.log('SUCCESS: Replaced normalized');
    } else {
        console.log('ERROR: Target block not found!');
    }
}
