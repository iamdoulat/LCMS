#!/usr/bin/env node

/**
 * Image optimization helper script
 * Provides utilities for image management and conversion
 */

const fs = require('fs');
const path = require('path');

// Placeholder images generator (creates minimal base64 images)
const createPlaceholders = () => {
    const placeholders = {
        avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzk0YTNiOCIvPgogIDxjaXJjbGUgY3g9IjIwIiBjeT0iMTYiIHI9IjYiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTI4IDMyQzI4IDI3LjU4MTcgMjQuNDE4MyAyNCAyMCAyNEMxNS41ODE3IDI0IDEyIDI3LjU4MTcgMTIgMzJIMjhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=',
        placeholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    };

    console.log('✅ Placeholder data ready for use in OptimizedImage component');
    return placeholders;
};

// Find all image files in a directory
const findImages = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
                findImages(filePath, fileList);
            }
        } else if (/\.(jpg|jpeg|png|gif)$/i.test(file)) {
            fileList.push(filePath);
        }
    });

    return fileList;
};

// Main execution
const main = () => {
    console.log('🖼️  Image Optimization Helper\n');

    const publicDir = path.join(process.cwd(), 'public');

    if (fs.existsSync(publicDir)) {
        const images = findImages(publicDir);
        console.log(`Found ${images.length} images in public directory:`);
        images.forEach(img => console.log(`  - ${path.relative(process.cwd(), img)}`));

        console.log('\n💡 Recommendations:');
        console.log('  1. Use OptimizedImage component for all images');
        console.log('  2. Next.js will automatically convert to WebP/AVIF');
        console.log('  3. Lazy loading is enabled by default');
        console.log('  4. Add blur placeholders for better UX');
    }

    console.log('\n📦 Available components:');
    console.log('  - <OptimizedImage /> for general images');
    console.log('  - <OptimizedAvatar /> for profile pictures');

    createPlaceholders();
};

if (require.main === module) {
    main();
}

module.exports = { createPlaceholders, findImages };
