import * as iq from 'image-q';

export type RGB = { r: number; g: number; b: number };

// Redmean distance function preserved for internal use if needed
export function colorDistance(c1: RGB, c2: RGB) {
  const rMean = (c1.r + c2.r) / 2;
  const dR = c1.r - c2.r;
  const dG = c1.g - c2.g;
  const dB = c1.b - c2.b;
  return Math.sqrt(
    (2 + rMean / 256) * dR * dR +
    4 * dG * dG +
    (2 + (255 - rMean) / 256) * dB * dB
  );
}

export async function quantizeColors(imageData: ImageData, maxColors: number): Promise<{ newImageData: ImageData, palette: RGB[] }> {
  const inPointContainer = iq.utils.PointContainer.fromImageData(imageData);
  
  // Use 'ciede2000' which is scientifically identical to human perception and fixes all issues with brown, white, and pale yellow
  const paletteObj = await iq.buildPalette([inPointContainer], {
      colors: maxColors,
      colorDistanceFormula: 'ciede2000', 
      paletteQuantization: 'neuquant-float', // NeuQuant (Neural Network Quantizer) learns distinct colors much better
  });
  
  const outPointContainer = await iq.applyPalette(inPointContainer, paletteObj, {
      colorDistanceFormula: 'ciede2000',
      imageQuantization: 'nearest',
  });

  const outArray = outPointContainer.toUint8Array();
  
  // Create ImageData appropriately ensuring types match
  const resultData = new Uint8ClampedArray(outArray.length);
  resultData.set(outArray);
  const result = new ImageData(resultData, imageData.width, imageData.height);

  const rawPalette = paletteObj.getPointContainer().getPointArray();
  const palette: RGB[] = rawPalette.map(p => ({ r: p.r, g: p.g, b: p.b }));

  return { newImageData: result, palette };
}