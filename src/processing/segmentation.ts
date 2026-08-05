import type { RGB } from './quantization';
import { colorDistance } from './quantization';

export type Region = {
  id: number;
  paletteIndex: number;
  pixelCount: number;
  centroid: { x: number; y: number };
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
};

function matchPalette(r: number, g: number, b: number, palette: RGB[]): number {
  let minD = Infinity; let best = 0;
  for (let i = 0; i < palette.length; i++) {
     const d = colorDistance(palette[i], { r, g, b });
     if (d < minD) { minD = d; best = i; }
  }
  return best;
}

export function segmentAndClean(
  imageData: ImageData, 
  palette: RGB[], 
  minRegionSize: number
): { regions: Region[], cleanedData: ImageData, lineArt: ImageData } {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // 1. Initial palette mapping
  const mapped = new Int32Array(width * height);
  for (let i = 0; i < width * height; i++) {
     mapped[i] = matchPalette(data[i*4], data[i*4+1], data[i*4+2], palette);
  }

  // 2. Flood Fill to find regions
  const regionMap = new Int32Array(width * height); // Stores region ID
  const regionPixels: number[][] = [[]]; // Index 0 is empty
  const regionPalettes: number[] = [0];
  let regionId = 1;

  for (let i = 0; i < width * height; i++) {
    if (regionMap[i] === 0) {
      const q = [i];
      regionMap[i] = regionId;
      const pIndex = mapped[i];
      const pixels = [];

      let head = 0;
      while (head < q.length) {
        const curr = q[head++];
        pixels.push(curr);
        const x = curr % width;
        const y = Math.floor(curr / width);

        // neighbors
        if (x < width - 1) { // right
          const nx = curr + 1;
          if (regionMap[nx] === 0 && mapped[nx] === pIndex) { regionMap[nx] = regionId; q.push(nx); }
        }
        if (x > 0) { // left
          const nx = curr - 1;
          if (regionMap[nx] === 0 && mapped[nx] === pIndex) { regionMap[nx] = regionId; q.push(nx); }
        }
        if (y < height - 1) { // bottom
          const nx = curr + width;
          if (regionMap[nx] === 0 && mapped[nx] === pIndex) { regionMap[nx] = regionId; q.push(nx); }
        }
        if (y > 0) { // top
          const nx = curr - width;
          if (regionMap[nx] === 0 && mapped[nx] === pIndex) { regionMap[nx] = regionId; q.push(nx); }
        }
      }
      regionPixels.push(pixels);
      regionPalettes.push(pIndex);
      regionId++;
    }
  }

  // 3. Merge small regions into their strongest neighbor
  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    for (let rid = 1; rid < regionPixels.length; rid++) {
      if (regionPixels[rid].length > 0 && regionPixels[rid].length < minRegionSize) {
         // Find neighbor counts
         const neighborCounts = new Map<number, number>();
         for (const p of regionPixels[rid]) {
            const x = p % width;
            const y = Math.floor(p / width);
            if (x < width - 1) { const n = regionMap[p+1]; if (n !== rid) neighborCounts.set(n, (neighborCounts.get(n) || 0) + 1); }
            if (x > 0) { const n = regionMap[p-1]; if (n !== rid) neighborCounts.set(n, (neighborCounts.get(n) || 0) + 1); }
            if (y < height - 1) { const n = regionMap[p+width]; if (n !== rid) neighborCounts.set(n, (neighborCounts.get(n) || 0) + 1); }
            if (y > 0) { const n = regionMap[p-width]; if (n !== rid) neighborCounts.set(n, (neighborCounts.get(n) || 0) + 1); }
         }

         // Find strongest valid neighbor
         let bestN = 0; let maxC = -1;
         for (const [nid, count] of neighborCounts.entries()) {
           if (nid > 0 && regionPixels[nid].length > 0 && count > maxC) {
             bestN = nid; maxC = count;
           }
         }

         if (bestN > 0) {
            // Assimilate!
            for (const p of regionPixels[rid]) {
              regionMap[p] = bestN;
              regionPixels[bestN].push(p);
            }
            regionPixels[rid] = []; // Clear
            mergedAny = true;
         }
      }
    }
  }

  // 4. Construct Cleaned Output and Line Art
  const cleanedData = new ImageData(width, height);
  const lineArt = new ImageData(width, height);

  // Default line art to white background
  lineArt.data.fill(255);

  const outRegions: Region[] = [];
  for (let rid = 1; rid < regionPixels.length; rid++) {
     const pixels = regionPixels[rid];
     if (pixels.length === 0) continue; // merged

     const pIndex = regionPalettes[rid]; 
     const color = palette[pIndex];

     let minX = width, minY = height, maxX = 0, maxY = 0;
     let sumX = 0, sumY = 0;

     for (const p of pixels) {
        const px = p % width;
        const py = Math.floor(p / width);

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        sumX += px; sumY += py;

        // Color cleaned image
        const idx = p * 4;
        cleanedData.data[idx] = color.r;
        cleanedData.data[idx+1] = color.g;
        cleanedData.data[idx+2] = color.b;
        cleanedData.data[idx+3] = 255;
     }

     if (pixels.length > minRegionSize / 2) { 
        outRegions.push({
           id: rid,
           paletteIndex: pIndex,
           pixelCount: pixels.length,
           centroid: { x: sumX / pixels.length, y: sumY / pixels.length },
           boundingBox: { minX, minY, maxX, maxY }
        });
     }
  }

  // Draw crisp edges
  for (let y = 0; y < height; y++) {
     for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const rid = regionMap[idx];
        
        let isBorder = false;
        if (x < width - 1 && regionMap[idx + 1] !== rid) isBorder = true;
        if (y < height - 1 && regionMap[idx + width] !== rid) isBorder = true;
        // Diagonal check helps make corners connect flawlessly
        if (x > 0 && y < height - 1 && regionMap[idx - 1 + width] !== rid) isBorder = true;
        
        if (isBorder) {
           // 2x2 solid crisp stroke for 2px thickness (much cleaner than 3x3 chunks)
           for (let dy = 0; dy <= 1; dy++) {
              for (let dx = 0; dx <= 1; dx++) {
                 const nx = x + dx; const ny = y + dy;
                 if (nx < width && ny < height) {
                    const nIdx = (ny * width + nx) * 4;
                    lineArt.data[nIdx] = 0;
                    lineArt.data[nIdx+1] = 0;
                    lineArt.data[nIdx+2] = 0;
                 }
              }
           }
        }
     }
  }

  return { regions: outRegions, cleanedData, lineArt };
}