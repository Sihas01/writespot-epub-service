const path = require("path");
const { download, upload } = require("./s3");
const { convert } = require("./epub");

const BUCKET = "writespot-uploads";

exports.startConversion = async ({ bookId, manuscriptKey, language }) => {
  const input = `/tmp/${path.basename(manuscriptKey)}`;
  const output = input.replace(/\.\w+$/, ".epub");

  await download(BUCKET, manuscriptKey, input);
  await convert(input, output, language);
  await upload(BUCKET, `epubs/${bookId}.epub`, output);
};
