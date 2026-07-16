import type { PsdLayerData } from '../store/AppContext';

export const splitImageIntoHeadAndBody = (
  img: HTMLImageElement,
  neckYPercent: number, // 0 to 100
  removeWhiteBg: boolean = true
): PsdLayerData[] => {
  const width = img.width;
  const height = img.height;
  
  // 1. Create transparent base canvas
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) return [];
  
  baseCtx.drawImage(img, 0, 0);
  
  // 2. Remove white background if requested
  if (removeWhiteBg) {
    const imgData = baseCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // 単純な白色（RGBがすべて240以上）または、ほぼ白に近い色を透過にする
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      if (r > 240 && g > 240 && b > 240) {
        data[i+3] = 0; // Alpha = 0
      }
    }
    baseCtx.putImageData(imgData, 0, 0);
  }
  
  const cutY = Math.round((neckYPercent / 100) * height);
  
  // 3. Create Head Canvas
  const headCanvas = document.createElement('canvas');
  headCanvas.width = width;
  headCanvas.height = cutY;
  const headCtx = headCanvas.getContext('2d');
  if (headCtx) {
    headCtx.drawImage(baseCanvas, 0, 0, width, cutY, 0, 0, width, cutY);
  }
  
  // 4. Create Body Canvas (15px overlapping upwards under the head to prevent gaps)
  const overlap = 15;
  const bodySourceY = Math.max(0, cutY - overlap);
  const bodyCanvasHeight = height - bodySourceY;
  
  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = width;
  bodyCanvas.height = bodyCanvasHeight;
  const bodyCtx = bodyCanvas.getContext('2d');
  if (bodyCtx) {
    bodyCtx.drawImage(baseCanvas, 0, bodySourceY, width, bodyCanvasHeight, 0, 0, width, bodyCanvasHeight);
  }
  
  return [
    {
      name: 'body',
      canvas: bodyCanvas,
      left: 0,
      top: bodySourceY,
      width: width,
      height: bodyCanvasHeight,
      visible: true,
      blendMode: 'source-over',
      opacity: 1
    },
    {
      name: 'head',
      canvas: headCanvas,
      left: 0,
      top: 0,
      width: width,
      height: cutY,
      visible: true,
      blendMode: 'source-over',
      opacity: 1
    }
  ];
};
