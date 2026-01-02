#!/usr/bin/env node

/**
 * Image Optimization Script
 * Automatically optimizes and converts images to WebP
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IMAGES_DIR = path.join(__dirname, '..', 'Images');
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png'];

console.log('🖼️  Starting image optimization...\n');

// Check if required tools are installed
function checkDependencies() {
    try {
        execSync('which cwebp', { stdio: 'ignore' });
        execSync('which optipng', { stdio: 'ignore' });
        execSync('which jpegoptim', { stdio: 'ignore' });
        return true;
    } catch (error) {
        console.error('❌ Missing dependencies. Please install:');
        console.error('   brew install webp optipng jpegoptim');
        console.error('   or');
        console.error('   apt-get install webp optipng jpegoptim');
        return false;
    }
}

// Get all image files
function getImageFiles() {
    if (!fs.existsSync(IMAGES_DIR)) {
        console.error(`❌ Images directory not found: ${IMAGES_DIR}`);
        return [];
    }
    
    return fs.readdirSync(IMAGES_DIR)
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return SUPPORTED_FORMATS.includes(ext);
        })
        .map(file => path.join(IMAGES_DIR, file));
}

// Get file size in KB
function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
}

// Optimize PNG files
function optimizePNG(filePath) {
    console.log(`  Optimizing PNG: ${path.basename(filePath)}`);
    const beforeSize = getFileSize(filePath);
    
    try {
        execSync(`optipng -o7 "${filePath}"`, { stdio: 'ignore' });
        const afterSize = getFileSize(filePath);
        const savings = ((beforeSize - afterSize) / beforeSize * 100).toFixed(1);
        console.log(`    ✓ ${beforeSize}KB → ${afterSize}KB (${savings}% reduction)`);
    } catch (error) {
        console.error(`    ✗ Failed to optimize: ${error.message}`);
    }
}

// Optimize JPEG files
function optimizeJPEG(filePath) {
    console.log(`  Optimizing JPEG: ${path.basename(filePath)}`);
    const beforeSize = getFileSize(filePath);
    
    try {
        execSync(`jpegoptim --strip-all --max=85 "${filePath}"`, { stdio: 'ignore' });
        const afterSize = getFileSize(filePath);
        const savings = ((beforeSize - afterSize) / beforeSize * 100).toFixed(1);
        console.log(`    ✓ ${beforeSize}KB → ${afterSize}KB (${savings}% reduction)`);
    } catch (error) {
        console.error(`    ✗ Failed to optimize: ${error.message}`);
    }
}

// Convert to WebP
function convertToWebP(filePath) {
    const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    
    // Skip if WebP already exists and is newer
    if (fs.existsSync(webpPath)) {
        const originalTime = fs.statSync(filePath).mtime;
        const webpTime = fs.statSync(webpPath).mtime;
        if (webpTime > originalTime) {
            console.log(`  Skipping WebP (already up to date): ${path.basename(webpPath)}`);
            return;
        }
    }
    
    console.log(`  Converting to WebP: ${path.basename(filePath)}`);
    const beforeSize = getFileSize(filePath);
    
    try {
        execSync(`cwebp -q 85 "${filePath}" -o "${webpPath}"`, { stdio: 'ignore' });
        const afterSize = getFileSize(webpPath);
        const savings = ((beforeSize - afterSize) / beforeSize * 100).toFixed(1);
        console.log(`    ✓ ${beforeSize}KB → ${afterSize}KB (${savings}% reduction)`);
    } catch (error) {
        console.error(`    ✗ Failed to convert: ${error.message}`);
    }
}

// Main execution
function main() {
    if (!checkDependencies()) {
        process.exit(1);
    }
    
    const imageFiles = getImageFiles();
    
    if (imageFiles.length === 0) {
        console.log('No images found to optimize.');
        return;
    }
    
    console.log(`Found ${imageFiles.length} images to process\n`);
    
    let totalBefore = 0;
    let totalAfter = 0;
    
    imageFiles.forEach(filePath => {
        const ext = path.extname(filePath).toLowerCase();
        totalBefore += parseFloat(getFileSize(filePath));
        
        // Optimize original
        if (ext === '.png') {
            optimizePNG(filePath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
            optimizeJPEG(filePath);
        }
        
        // Convert to WebP
        convertToWebP(filePath);
        
        console.log('');
    });
    
    // Calculate total savings
    const webpFiles = fs.readdirSync(IMAGES_DIR)
        .filter(file => file.endsWith('.webp'))
        .map(file => path.join(IMAGES_DIR, file));
    
    webpFiles.forEach(file => {
        totalAfter += parseFloat(getFileSize(file));
    });
    
    console.log('━'.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Original images: ${totalBefore.toFixed(2)}KB`);
    console.log(`   WebP images: ${totalAfter.toFixed(2)}KB`);
    console.log(`   Total savings: ${((totalBefore - totalAfter) / totalBefore * 100).toFixed(1)}%`);
    console.log('━'.repeat(50));
    console.log('\n✅ Image optimization complete!\n');
}

main();
