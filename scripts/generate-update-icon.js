const { Jimp } = require('jimp');
const fs = require('fs');

async function addUpdateBadge(inputFile, outputFile, size) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  
  // Calculate badge size and position
  const badgeRadius = Math.max(3, Math.floor(size / 6)); 
  const badgeCenter = { x: size - badgeRadius - 1, y: badgeRadius + 1 };
  
  // Draw a blue circle (badge)
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const dx = x - badgeCenter.x;
    const dy = y - badgeCenter.y;
    const distSq = dx * dx + dy * dy;
    const rSq = badgeRadius * badgeRadius;
    
    // Antialiasing for the circle edge
    if (distSq <= rSq) {
      this.bitmap.data[idx + 0] = 59;  // Blue (e.g., #3B82F6)
      this.bitmap.data[idx + 1] = 130;
      this.bitmap.data[idx + 2] = 246;
      this.bitmap.data[idx + 3] = 255;
    } else if (distSq <= (badgeRadius + 0.5) * (badgeRadius + 0.5)) {
      // Soft edge
      const alpha = 255 * (1 - (Math.sqrt(distSq) - badgeRadius));
      if (alpha > 0) {
        // Blend blue over the existing pixel
        const existingA = this.bitmap.data[idx + 3] / 255;
        const newA = alpha / 255;
        const outA = newA + existingA * (1 - newA);
        if (outA > 0) {
            this.bitmap.data[idx + 0] = (59 * newA + this.bitmap.data[idx + 0] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 1] = (130 * newA + this.bitmap.data[idx + 1] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 2] = (246 * newA + this.bitmap.data[idx + 2] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 3] = outA * 255;
        }
      }
    }
  });

  await image.write(outputFile);
  console.log(`Generated ${outputFile} at ${size}x${size}`);
}

async function main() {
  await addUpdateBadge('assets/tray-icon-app.png', 'assets/tray-icon-update-app.png', 22);
  await addUpdateBadge('assets/tray-icon-app@2x.png', 'assets/tray-icon-update-app@2x.png', 44);
}

main().catch(console.error);
