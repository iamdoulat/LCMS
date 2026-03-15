
/**
 * Compresses an image file using Canvas.
 * @param file The original image file
 * @param maxWidth Optional maximum width (default 1200)
 * @param maxHeight Optional maximum height (default 1200)
 * @param quality Optional quality from 0 to 1 (default 0.6 for "low regulation")
 * @returns A promise that resolves to the compressed Blob
 */
export async function compressImage(
    file: File, 
    maxWidth: number = 1200, 
    maxHeight: number = 1200, 
    quality: number = 0.6
): Promise<Blob> {
    // Only compress images
    if (!file.type.startsWith('image/')) {
        return file;
    }

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

                // Scale down if larger than max dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file); // Fallback to original
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            resolve(file); // Fallback to original
                        }
                    },
                    file.type,
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
