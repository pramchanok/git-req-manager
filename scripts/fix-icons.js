const { Jimp } = require('jimp');
const fs = require('fs');

async function createBlueLogo(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  
  // To make it blue, we can iterate over pixels and change the hue, or simply map the colors.
  // The original logo is orange (R: ~250, G: ~100, B: ~30). We want to map this to blue.
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    
    // Simple color swap: map Red channel to Blue, Blue to Red
    // Or just tint it blue by mixing
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (this.bitmap.data[idx + 3] > 0) {
      this.bitmap.data[idx + 0] = b; // new Red
      this.bitmap.data[idx + 1] = g; // new Green
      this.bitmap.data[idx + 2] = r; // new Blue
      // This will turn Orange (R>G>B) into Blue (B>G>R)
    }
  });

  await image.write(outputFile);
  console.log(`Generated ${outputFile}`);
}

async function addBetterBadge(inputFile, outputFile, size) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  
  // Make the badge slightly smaller and positioned better
  const badgeRadius = Math.floor(size / 7); 
  // Position it so it touches the top right edge of the canvas but leaves a tiny margin
  const badgeCenter = { x: size - badgeRadius - 2, y: badgeRadius + 2 };
  
  // Draw a red circle (badge) with a small white border for contrast
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const dx = x - badgeCenter.x;
    const dy = y - badgeCenter.y;
    const distSq = dx * dx + dy * dy;
    const rSq = badgeRadius * badgeRadius;
    const borderSq = (badgeRadius + 1.5) * (badgeRadius + 1.5);
    
    if (distSq <= rSq) {
      // Red core
      this.bitmap.data[idx + 0] = 239; 
      this.bitmap.data[idx + 1] = 68;
      this.bitmap.data[idx + 2] = 68;
      this.bitmap.data[idx + 3] = 255;
    } else if (distSq <= borderSq) {
      // White border
      const alpha = 255 * (1 - (Math.sqrt(distSq) - (badgeRadius + 1)));
      if (alpha > 0) {
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
        this.bitmap.data[idx + 3] = Math.min(255, alpha + this.bitmap.data[idx + 3]);
      }
    }
  });

  await image.write(outputFile);
  console.log(`Generated ${outputFile}`);
}

async function main() {
  await createBlueLogo('assets/tray-icon-app.png', 'assets/tray-icon-update-app.png');
  await createBlueLogo('assets/tray-icon-app@2x.png', 'assets/tray-icon-update-app@2x.png');
  
  await addBetterBadge('assets/tray-icon-app.png', 'assets/tray-icon-badge.png', 22);
  await addBetterBadge('assets/tray-icon-app@2x.png', 'assets/tray-icon-badge@2x.png', 44);
  
  const html = `
    <html>
      <body style="background: #1e293b; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
        <h2>Tray Icon Previews (Updated)</h2>
        <div style="display: flex; gap: 40px; background: #0f172a; padding: 30px; border-radius: 12px;">
          <div style="text-align: center;">
            <p>Active (Better Badge)</p>
            <img src="${process.cwd().replace(/\\/g, '/')}/assets/tray-icon-badge@2x.png" width="44" height="44" style="image-rendering: pixelated;" />
          </div>
          <div style="text-align: center;">
            <p>Update (Blue Logo)</p>
            <img src="${process.cwd().replace(/\\/g, '/')}/assets/tray-icon-update-app@2x.png" width="44" height="44" style="image-rendering: pixelated;" />
          </div>
        </div>
      </body>
    </html>
  `;
  fs.writeFileSync('assets/preview2.html', html);
}

main().catch(console.error);
