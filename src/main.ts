import { quantizeColors } from './processing/quantization';
import { segmentAndClean } from './processing/segmentation';
import { jsPDF } from 'jspdf';

const imageInput = document.getElementById('image-upload') as HTMLInputElement;
const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
const exportPdfBtn = document.getElementById('export-pdf-btn') as HTMLButtonElement;
const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;
const tabs = document.querySelectorAll('.tab');
const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const legendContainer = document.getElementById('legend') as HTMLDivElement;
const originalThumbnail = document.getElementById('original-thumbnail') as HTMLImageElement;
const ctx = mainCanvas.getContext('2d')!;

let originalImage: HTMLImageElement | null = null;
let currentPreview: 'original' | 'lineart' | 'quantized' | 'final' = 'original';

let cachedLineArt: ImageData | null = null;
let cachedQuantized: ImageData | null = null;
let cachedFinal: HTMLCanvasElement | null = null;

type BatchResult = {
  finalDataUrl: string;
  width: number;
  height: number;
  palette: {r:number, g:number, b:number}[];
  thumbUrl: string;
  naturalWidth: number;
  naturalHeight: number;
};
let batchResults: BatchResult[] = [];
let selectedFiles: File[] = [];

imageInput.addEventListener('change', (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  
  selectedFiles = Array.from(files);

  // Load first image for initial preview
  const objectUrl = URL.createObjectURL(selectedFiles[0]);
  const img = new Image();
  img.onload = () => {
    originalImage = img;
    originalThumbnail.src = objectUrl;
    
    const MAX_DIM = 600;
    let width = img.width;
    let height = img.height;
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }

    mainCanvas.width = width;
    mainCanvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    cachedLineArt = null;
    cachedQuantized = null;
    cachedFinal = null;
    batchResults = [];
    processBtn.disabled = false;
    exportPdfBtn.disabled = true;
    
    processBtn.textContent = `Process ${selectedFiles.length} Image(s)`;
    exportPdfBtn.textContent = `Export PDF`;

    setActiveTab('original');
  };
  img.src = objectUrl;
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    setActiveTab(tab.getAttribute('data-target') as any);
  });
});

function setActiveTab(target: 'original' | 'lineart' | 'quantized' | 'final') {
  currentPreview = target;
  tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-target') === target));
  renderCurrentState();
}

function renderCurrentState() {
  if (!originalImage) return;

  if (currentPreview === 'original') {
    ctx.drawImage(originalImage, 0, 0, mainCanvas.width, mainCanvas.height);
  } else if (currentPreview === 'lineart' && cachedLineArt) {
    ctx.putImageData(cachedLineArt, 0, 0);
  } else if (currentPreview === 'quantized' && cachedQuantized) {
    ctx.putImageData(cachedQuantized, 0, 0);
  } else if (currentPreview === 'final' && cachedFinal) {
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.drawImage(cachedFinal, 0, 0);
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

processBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;
  
  loadingIndicator.style.display = 'flex';
  processBtn.disabled = true;
  batchResults = [];

  try {
    const maxColors = parseInt(difficultySelect.value, 10);

    for (let i = 0; i < selectedFiles.length; i++) {
      loadingIndicator.textContent = `Processing image ${i + 1} of ${selectedFiles.length}...`;
      await new Promise(r => setTimeout(r, 50)); // Yield to allow UI status update

      const img = await loadImage(selectedFiles[i]);
      
      let width = img.width;
      let height = img.height;
      const MAX_DIM = 600;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      const pCanvas = document.createElement('canvas');
      pCanvas.width = width;
      pCanvas.height = height;
      const pCtx = pCanvas.getContext('2d')!;
      
      // Remove heavy contrast/saturation CSS filters that were destroying subtle skin tones
      // Just draw the pure original image to let the CIEDE2000 algorithm do its job accurately
      pCtx.filter = 'none'; 
      pCtx.drawImage(img, 0, 0, width, height);
      const sourceData = pCtx.getImageData(0, 0, width, height);

      // Quantization (Now using await with image-q)
      const result = await quantizeColors(sourceData, maxColors);
      const palette = result.palette;

      // Segmentation & Clean
      const minRegionArea = Math.floor((width * height) * 0.0002); 
      const segResult = segmentAndClean(result.newImageData, palette, minRegionArea);
      
      // Merge into Final Output Canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const fCtx = finalCanvas.getContext('2d')!;
      
      fCtx.putImageData(segResult.lineArt, 0, 0);

      fCtx.font = 'normal 9px Arial, Helvetica, sans-serif';
      fCtx.textAlign = 'center';
      fCtx.textBaseline = 'middle';
      fCtx.fillStyle = '#888888'; // Medium gray so it's readable but easily covered by crayons

      segResult.regions.forEach(region => {
        const w = region.boundingBox.maxX - region.boundingBox.minX;
        const h = region.boundingBox.maxY - region.boundingBox.minY;
        // Increase minimum box size so text isn't drawn in extremely tight spots
        if (w > 16 && h > 16 && region.pixelCount > 60) {
          const text = (region.paletteIndex + 1).toString();
          fCtx.fillText(text, region.centroid.x, region.centroid.y);
        }
      });

      batchResults.push({
        finalDataUrl: finalCanvas.toDataURL('image/jpeg', 0.9),
        width: width,
        height: height,
        palette: palette,
        thumbUrl: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });

      // Update UI components for the FIRST image to act as preview
      if (i === 0) {
        cachedLineArt = segResult.lineArt;
        cachedQuantized = segResult.cleanedData;
        cachedFinal = finalCanvas;
        
        legendContainer.innerHTML = '';
        palette.forEach((c, idx) => {
          const div = document.createElement('div');
          div.className = 'legend-item';
          div.innerHTML = `
            <div class="color-box" style="background-color: rgb(${c.r}, ${c.g}, ${c.b})"></div>
            <span>${idx + 1}</span>
          `;
          legendContainer.appendChild(div);
        });
      }
    }

    exportPdfBtn.disabled = false;
    exportPdfBtn.textContent = `Export PDF (${batchResults.length} Pages)`;
    setActiveTab('final');

  } catch(e) {
    console.error(e);
    alert('Processing failed. See console.');
  } finally {
    loadingIndicator.style.display = 'none';
    loadingIndicator.textContent = 'Processing...';
    processBtn.disabled = false;
  }
});

exportPdfBtn.addEventListener('click', () => {
  if (batchResults.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  
  batchResults.forEach((res, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    let drawWidth = pageWidth - margin * 2;
    let scale = drawWidth / res.width;
    let drawHeight = res.height * scale;

    const maxDrawHeight = pageHeight - 120; // Leaving more room for legend/footer and bigger thumbnail
    if (drawHeight > maxDrawHeight) {
      scale = maxDrawHeight / res.height;
      drawHeight = res.height * scale;
      drawWidth = res.width * scale;
    }

    const xOffset = margin + ((pageWidth - margin * 2) - drawWidth) / 2;

    pdf.text(`Photo-to-Coloring Worksheet (${index + 1}/${batchResults.length})`, margin, 15);
    pdf.addImage(res.finalDataUrl, 'JPEG', xOffset, 20, drawWidth, drawHeight);

    let currentY = 20 + drawHeight + 10;
    pdf.setFontSize(10);
    
    let currentX = margin;
    res.palette.forEach((c, idx) => {
      if (currentX > pageWidth - 30) {
        currentX = margin;
        currentY += 10;
      }
      pdf.setFillColor(c.r, c.g, c.b);
      pdf.rect(currentX, currentY, 6, 6, 'FD');
      pdf.text((idx + 1).toString(), currentX + 8, currentY + 5);
      currentX += 18;
    });

    const footerY = pageHeight - 40;
    pdf.setFontSize(10);
    pdf.text(`Name: ______________________`, margin, footerY);
    pdf.text(`Date: ______________________`, margin, footerY + 10);
    pdf.text(`Time Started: ______`, margin, footerY + 20);
    pdf.text(`Time Ended: ______`, margin, footerY + 30);

    const maxTw = 75;
    const maxTh = 55;
    let tw = maxTw;
    let th = (res.naturalHeight / res.naturalWidth) * tw;
    if (th > maxTh) {
      th = maxTh;
      tw = (res.naturalWidth / res.naturalHeight) * th;
    }
    
    pdf.addImage(res.thumbUrl, 'JPEG', pageWidth - margin - tw, pageHeight - margin - th, tw, th);
  });

  pdf.save('coloring-book.pdf');
});