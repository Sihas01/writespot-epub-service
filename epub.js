const { exec } = require("child_process");

exports.convert = (input, output, language) => {
  const lang = language === "si" ? "si" : "en";
  const font = lang === "si" ? "Noto Serif Sinhala" : "Times New Roman";

  return new Promise((resolve, reject) => {
    exec(
      `ebook-convert "${input}" "${output}" --language ${lang} --embed-font-family "${font}"`,
      err => (err ? reject(err) : resolve())
    );
  });
};
