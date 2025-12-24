const express = require("express");
const { startConversion } = require("./convert");

const app = express();
app.use(express.json());

app.post("/convert", (req, res) => {
  startConversion(req.body); 
  res.json({ message: "Conversion started" });
});

app.listen(4000, () =>
  console.log("EPUB Service running on port 4000")
);
