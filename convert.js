const path = require("path");
const os = require("os");
const fs = require("fs");
const { download, upload } = require("./s3");
const { convert } = require("./epub");

const BUCKET = "writespot-uploads";

exports.startConversion = async ({ bookId, manuscriptKey, language }) => {
  const tmpDir = os.tmpdir();
  const input = path.join(tmpDir, path.basename(manuscriptKey));
  const output = input.replace(/\.\w+$/, ".epub");
  
  // Ensure temp directory exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  await download(BUCKET, manuscriptKey, input);
  await convert(input, output, language);
  await upload(BUCKET, `epubs/${bookId}.epub`, output);
};
