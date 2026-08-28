import { createSample16by9AssetSheetDataUrl } from './sampleAssetSheet';
import { parse16by9AssetSheet } from './avatarHelper';

export const loadDemoVTuberIntoState = async (
  setBaseImage: (url: string | null) => void,
  setParsedAssetSheetParts: (parts: any) => void,
  setAvatarCoords: (coords: any) => void
) => {
  try {
    const sampleUrl = createSample16by9AssetSheetDataUrl();
    const img = new Image();
    img.src = sampleUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const parsed = await parse16by9AssetSheet(img);
    (parsed as any)._originalSheetDataUrl = sampleUrl;
    setParsedAssetSheetParts(parsed);
    setBaseImage(parsed.baseBustDataUrl);
    setAvatarCoords({
      leftEye: parsed.suggestedCoords.leftEye,
      rightEye: parsed.suggestedCoords.rightEye,
      mouth: parsed.suggestedCoords.mouth,
      mouthState: 'closed',
      eyeState: 'open',
      neckY: 85,
      neckX: 50,
      removeWhiteBg: true
    });
    return true;
  } catch (err) {
    console.error('Failed to auto-load demo VTuber:', err);
    return false;
  }
};
