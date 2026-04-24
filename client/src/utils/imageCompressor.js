/**
 * imageCompressor.js
 *
 * Compresses images client-side before upload using Canvas API.
 * Reduces 5-10MB phone photos to ~800KB-1.2MB without visible quality loss.
 * Groq Vision API works perfectly at this resolution for OCR.
 *
 * Target: max 1200px on longest side, 85% JPEG quality
 * Result: 10MB photo → ~900KB, 10x faster upload
 */

const MAX_DIMENSION = 1200; // px — sufficient for menu OCR
const JPEG_QUALITY = 0.85;  // 85% quality — imperceptible difference for text
const TARGET_MAX_KB = 1200; // 1.2MB target

/**
 * Compress a single File object.
 * Returns a new File with compressed image data.
 */
export async function compressImage(file) {
  // Skip if already small enough
  if (file.size <= TARGET_MAX_KB * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      // Draw to canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; } // fallback to original if canvas fails
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          console.log(`[compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original on error
    };

    img.src = url;
  });
}

/**
 * Compress multiple files in parallel.
 * Returns array of compressed File objects.
 */
export async function compressImages(files) {
  return Promise.all(files.map(compressImage));
}
