const { Jimp } = require('jimp');

async function createSplash() {
  const W = 320;
  const H = 200;
  
  // Background color #111827 (slate-900)
  const bgColor = 0x111827FF;
  const bg = new Jimp({ width: W, height: H, color: bgColor });
  
  // Load and resize icon to 64x64
  const icon = await Jimp.read('assets/icon.png');
  icon.resize({ w: 64, h: 64 });
  
  // Center the icon horizontally, place at y=32
  const iconX = Math.floor((W - 64) / 2);
  const iconY = 32;
  bg.composite(icon, iconX, iconY);
  
  // Draw "GitLab MR Manager" as pixel-rendered text
  // We'll render simple bitmap text since jimp fonts don't work well
  // Instead, we rely on NSIS text labels placed ON TOP of the image
  
  // Draw subtle 1px border (#374151)
  const borderColor = 0x374151FF;
  for (let x = 0; x < W; x++) {
    bg.setPixelColor(borderColor, x, 0);
    bg.setPixelColor(borderColor, x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    bg.setPixelColor(borderColor, 0, y);
    bg.setPixelColor(borderColor, W - 1, y);
  }
  
  // NO progress bar track here - NSIS handles it
  
  await bg.write('assets/splash.bmp');
  console.log(`Created assets/splash.bmp (${W}x${H})`);
}

createSplash();
