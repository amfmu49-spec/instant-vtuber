import { generateProceduralAssetSheetDataUrl } from './proceduralAssetSheet';

export const generateSample16by9AssetSheet = (): string => {
  return generateProceduralAssetSheetDataUrl("cute anime girl with silver hair, twin tails, blue eyes, wearing stylish sailor uniform with red ribbon, cat ears");
};

export const createSample16by9AssetSheetDataUrl = generateSample16by9AssetSheet;
