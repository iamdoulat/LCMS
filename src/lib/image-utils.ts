
// src/lib/image-utils.ts

import type { PixelCrop } from 'react-image-crop';

// Helper function to get a cropped image blob
export async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string,
  targetWidth?: number,
  targetHeight?: number
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Use target dimensions if provided, otherwise use crop dimensions
  canvas.width = targetWidth ?? crop.width;
  canvas.height = targetHeight ?? crop.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  // Draw the image onto the canvas with cropping
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.95 // High quality
    );
  });
}
