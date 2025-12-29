const express = require("express");
const { startConversion } = require("./convert");
const { getStream } = require("./s3");

const app = express();
app.use(express.json());

const BUCKET = "writespot-uploads";

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

app.get("/epub/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const epubKey = `epubs/${bookId}.epub`;
    
    // Get stream from S3
    const stream = await getStream(BUCKET, epubKey);
    
    // Set headers for EPUB download
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${bookId}.epub"`);
    
    // Pipe stream directly to response
    stream.pipe(res);
    
    // Handle stream errors
    stream.on('error', (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to stream EPUB", 
          message: error.message 
        });
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    if (!res.headersSent) {
      res.status(404).json({ 
        error: "EPUB not found", 
        message: error.message 
      });
    }
  }
});

app.listen(4000, () =>
  console.log("EPUB Service running on port 4000")
);
