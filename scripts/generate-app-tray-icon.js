const { Jimp } = require('jimp');
const fs = require('fs');

async function resizeIcon(inputFile, outputFile, size) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  image.resize({ w: size, h: size });
  await image.write(outputFile);
  console.log(`Generated ${outputFile} at ${size}x${size}`);
}

async function main() {
  await resizeIcon('assets/icon.png', 'assets/tray-icon-app.png', 22);
  await resizeIcon('assets/icon.png', 'assets/tray-icon-app@2x.png', 44);
}

main().catch(console.error);
