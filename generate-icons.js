const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const inputFile = path.join(__dirname, 'icons', 'icon.svg');

async function generateIcons() {
    try {
        for (const size of sizes) {
            const outputFile = path.join(__dirname, 'icons', `icon${size}.png`);
            await sharp(inputFile)
                .resize(size, size)
                .toFile(outputFile);
            console.log(`Generated ${outputFile}`);
        }
        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

generateIcons(); 