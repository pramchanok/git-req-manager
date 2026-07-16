const { Jimp } = require('jimp');
const fs = require('fs');

async function createGreyIcon(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) return;
  const image = await Jimp.read(inputFile);
  image.greyscale();
  // We can also lower the opacity/brightness a bit if needed, but greyscale is usually enough
  await image.write(outputFile);
  console.log(`Generated ${outputFile}`);
}

async function main() {
  await createGreyIcon('assets/tray-icon-app.png', 'assets/tray-icon-grey.png');
  await createGreyIcon('assets/tray-icon-app@2x.png', 'assets/tray-icon-grey@2x.png');
}

main().catch(console.error);
