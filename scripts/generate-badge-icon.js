const { Jimp } = require('jimp');
const fs = require('fs');

async function addBadge(inputFile, outputFile, size) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  
  // Calculate badge size and position
  const badgeRadius = Math.max(3, Math.floor(size / 6)); 
  const badgeCenter = { x: size - badgeRadius - 1, y: badgeRadius + 1 };
  
  // Draw a red circle (badge)
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const dx = x - badgeCenter.x;
    const dy = y - badgeCenter.y;
    const distSq = dx * dx + dy * dy;
    const rSq = badgeRadius * badgeRadius;
    
    // Antialiasing for the circle edge
    if (distSq <= rSq) {
      this.bitmap.data[idx + 0] = 239; // Red (e.g., #EF4444)
      this.bitmap.data[idx + 1] = 68;
      this.bitmap.data[idx + 2] = 68;
      this.bitmap.data[idx + 3] = 255;
    } else if (distSq <= (badgeRadius + 0.5) * (badgeRadius + 0.5)) {
      // Soft edge
      const alpha = 255 * (1 - (Math.sqrt(distSq) - badgeRadius));
      if (alpha > 0) {
        // Blend red over the existing pixel
        const existingA = this.bitmap.data[idx + 3] / 255;
        const newA = alpha / 255;
        const outA = newA + existingA * (1 - newA);
        if (outA > 0) {
            this.bitmap.data[idx + 0] = (239 * newA + this.bitmap.data[idx + 0] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 1] = (68 * newA + this.bitmap.data[idx + 1] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 2] = (68 * newA + this.bitmap.data[idx + 2] * existingA * (1 - newA)) / outA;
            this.bitmap.data[idx + 3] = outA * 255;
        }
      }
    }
  });

  await image.write(outputFile);
  console.log(`Generated ${outputFile} at ${size}x${size}`);
}

async function main() {
  await addBadge('assets/tray-icon-app.png', 'assets/tray-icon-badge.png', 22);
  await addBadge('assets/tray-icon-app@2x.png', 'assets/tray-icon-badge@2x.png', 44);
  
  // Create an HTML page to preview the icons in the artifact folder
  const html = `
    <html>
      <body style="background: #1e293b; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
        <h2>Tray Icon Previews</h2>
        <div style="display: flex; gap: 40px; background: #0f172a; padding: 30px; border-radius: 12px;">
          <div style="text-align: center;">
            <p>Default (No MRs)</p>
            <img src="${process.cwd().replace(/\\/g, '/')}/assets/tray-icon-grey@2x.png" width="44" height="44" style="image-rendering: pixelated;" />
          </div>
          <div style="text-align: center;">
            <p>Active (With Red Dot)</p>
            <img src="${process.cwd().replace(/\\/g, '/')}/assets/tray-icon-badge@2x.png" width="44" height="44" style="image-rendering: pixelated;" />
          </div>
        </div>
      </body>
    </html>
  `;
  fs.writeFileSync('assets/preview.html', html);
}

main().catch(console.error);
