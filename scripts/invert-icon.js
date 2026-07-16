const { Jimp } = require('jimp');
const fs = require('fs');

async function invertIcon(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  image.invert();
  await image.write(outputFile);
  console.log(`Generated ${outputFile}`);
}

async function main() {
  await invertIcon('assets/tray-icon.png', 'assets/tray-icon-light.png');
  await invertIcon('assets/tray-icon@2x.png', 'assets/tray-icon-light@2x.png');
}

main().catch(console.error);
