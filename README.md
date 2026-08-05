# Photo-to-Coloring Book App

This is a browser-based application designed to convert uploaded photographs into printable color-by-number pages, specifically optimized for kindergarten and early elementary school children.

## Live Demo
**[Play the app here!](https://potterlam.github.io/Photo-to-Coloring-App/)**

## Image Selection Guide for Best Results
Since the algorithm reduces images into 5 to 20 solid colors and groups them for young kids to paint, not all photos will yield perfect results. Here are the tips for finding or taking the best photos:

### Tips for Searching / Picking Images:
1. **High Contrast, Solid Colors:** Search for images with a clear difference between the subject and the background. (Keywords: `flat design`, `vector illustration`, `clipart`, `bright colors`).
2. **Clear Shapes, Minimal Texture:** Avoid photos with too much texture like grass, fur, or distant tree leaves. (Keywords: `cartoon style`, `simple drawing`).
3. **Simple Backgrounds:** Solid color backgrounds (like pure white, blue sky, or studio backdrops) work much better than busy backgrounds. (Keywords: `isolated on white`, `transparent background`).
4. **Close-ups / Macros:** Focus on a single subject (a truck, a flower, a cupcake, an animal face) rather than a wide landscape. The bigger the object takes up the frame, the larger the regions will be for kids to color inside.

### Examples of Good Keywords to Search on Google/Pexels/Unsplash:
- `"simple cartoon animals isolated"`
- `"flat vector style vehicles"`
- `"fruit photography white background"`
- `"pop art illustration"`

## Features
- **Batch Processing:** Choose multiple images at once (up to 20+ pages).
- **Format Support:** Supports JPG, PNG, WEBP, GIF, JFIF, BMP, and more directly in the browser.
- **Kindergarten Mode:** Optimized Region Merging to eliminate microscopic dots, preserving only paintable shapes.
- **Print-Ready PDF:** Generates a compiled coloring book PDF complete with Name/Date headers, dedicated color swatches with indices, and high-quality printed outlines. 

## Run Locally
```bash
npm install
npm run dev
```