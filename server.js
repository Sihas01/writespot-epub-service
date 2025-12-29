const express = require("express");
const { startConversion } = require("./convert");

const app = express();
app.use(express.json());

app.post("/convert", async (req, res) => {
  try {
    await startConversion(req.body);
    res.json({ message: "Conversion completed successfully" });
  } catch (error) {
    console.error("Conversion error:", error);
    res.status(500).json({ 
      error: "Conversion failed", 
      message: error.message 
    });
  }
});

app.listen(4000, () =>
  console.log("EPUB Service running on port 4000")
);
