export function getGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    result.data[i] = result.data[i + 1] = result.data[i + 2] = gray;
    result.data[i + 3] = data[i + 3];
  }
  return result;
}

export function detectEdges(imageData: ImageData, threshold = 50): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const result = new ImageData(width, height);
  
  // Simple Sobel edge detection
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  const getIndex = (x: number, y: number) => (y * width + x) * 4;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let pixelX = 0;
      let pixelY = 0;

      let kIndex = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = getIndex(x + kx, y + ky);
          const intensity = data[idx]; // assuming grayscale
          pixelX += intensity * kernelX[kIndex];
          pixelY += intensity * kernelY[kIndex];
          kIndex++;
        }
      }

      const mag = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
      const outIdx = getIndex(x, y);
      
      const isEdge = mag > threshold;
      const color = isEdge ? 0 : 255;
      
      result.data[outIdx] = color;
      result.data[outIdx + 1] = color;
      result.data[outIdx + 2] = color;
      result.data[outIdx + 3] = 255;
    }
  }

  return result;
}