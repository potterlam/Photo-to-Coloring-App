export type RGB = { r: number; g: number; b: number };

function colorDistance(c1: RGB, c2: RGB) {
  return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
}

export function quantizeColors(imageData: ImageData, maxColors: number): { newImageData: ImageData, palette: RGB[] } {
  const data = imageData.data;
  const pixels: RGB[] = [];
  
  // Downsample to speed up K-means grouping safely
  const step = 4 * 4; 
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] > 0) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  if(pixels.length === 0) pixels.push({r: 255, g: 255, b: 255});

  // K-means++ initialization (forces centroids to be apart, preventing same-color background splits like 1 and 9)
  let centroids: RGB[] = [pixels[Math.floor(Math.random() * pixels.length)]];
  for (let i = 1; i < maxColors; i++) {
    let maxDist = -1;
    let bestPixel = centroids[0];
    for (let j = 0; j < pixels.length; j += 5) {
      const p = pixels[j];
      let minDistToCentroids = Infinity;
      for (const c of centroids) {
        const d = colorDistance(p, c);
        if (d < minDistToCentroids) minDistToCentroids = d;
      }
      if (minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        bestPixel = p;
      }
    }
    centroids.push(bestPixel);
  }

  // K-means iterations
  for (let iteration = 0; iteration < 8; iteration++) {
    const sumR = new Float32Array(maxColors);
    const sumG = new Float32Array(maxColors);
    const sumB = new Float32Array(maxColors);
    const counts = new Int32Array(maxColors);

    for (const p of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < maxColors; i++) {
        const d = colorDistance(p, centroids[i]);
        if (d < minDist) {
          minDist = d;
          minIdx = i;
        }
      }
      sumR[minIdx] += p.r;
      sumG[minIdx] += p.g;
      sumB[minIdx] += p.b;
      counts[minIdx]++;
    }
    
    // Update centroids
    for (let i = 0; i < maxColors; i++) {
      if (counts[i] > 0) {
        centroids[i] = {
          r: Math.round(sumR[i] / counts[i]),
          g: Math.round(sumG[i] / counts[i]),
          b: Math.round(sumB[i] / counts[i])
        };
      }
    }
  }

  // Apply palette to image
  const result = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < data.length; i += 4) {
    const p = { r: data[i], g: data[i + 1], b: data[i + 2] };
    let minDist = Infinity;
    let minIdx = 0;
    for (let c = 0; c < maxColors; c++) {
      const d = colorDistance(p, centroids[c]);
      if (d < minDist) {
        minDist = d;
        minIdx = c;
      }
    }
    result.data[i] = centroids[minIdx].r;
    result.data[i + 1] = centroids[minIdx].g;
    result.data[i + 2] = centroids[minIdx].b;
    result.data[i + 3] = data[i + 3];
  }

  return { newImageData: result, palette: centroids };
}