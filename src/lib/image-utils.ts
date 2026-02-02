
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

/**
 * Compress and resize an image file
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1024,
  quality: number = 0.7
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
