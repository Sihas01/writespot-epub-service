const { exec } = require("child_process");

exports.convert = (input, output, language) => {
  const lang = language === "si" ? "si" : "en";

  const fontArg =
    lang === "si"
      ? '--embed-font-family "Noto Serif Sinhala"'
      : "";

  return new Promise((resolve, reject) => {
    const cmd = `ebook-convert "${input}" "${output}" --language ${lang} ${fontArg}`;

    exec(cmd, err => (err ? reject(err) : resolve()));
  });
};
