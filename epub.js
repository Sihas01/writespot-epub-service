const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const JSZip = require("jszip");

/**
 * Detects chapter headings in text
 * Supports English (Chapter 1, CHAPTER 2, etc.) and Sinhala patterns
 */
function detectChapters(text) {
  const chapters = [];
  const lines = text.split(/\r?\n/);
  
  // Patterns for chapter detection
  const chapterPatterns = [
    /^chapter\s+(\d+)/i,
    /^chapter\s+([ivxlcdm]+)/i,
    /^(\d+)\.\s+chapter/i,
    /^chapter\s+(\d+):/i,
    /^පරිච්ඡේද\s+(\d+)/i,
    /^(\d+)\s*පරිච්ඡේදය/i,
    /^පළමු\s+පරිච්ඡේදය/i,
    /^දෙවන\s+පරිච්ඡේදය/i,
    /^තෙවන\s+පරිච්ඡේදය/i,
    /^සිව්වන\s+පරිච්ඡේදය/i,
    /^පස්වන\s+පරිච්ඡේදය/i,
  ];
  
  // Also detect large headings (all caps, or lines with few words that are likely titles)
  let currentChapter = { title: "Introduction", startIndex: 0, content: [] };
  let chapterIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Check if line matches chapter pattern
    let isChapterHeading = false;
    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        isChapterHeading = true;
        break;
      }
    }
    
    // Also check for large headings (all caps with reasonable length, or short lines that might be titles)
    if (!isChapterHeading && line.length > 0) {
      const isAllCaps = line === line.toUpperCase() && line.length < 100 && /[A-Z]/.test(line);
      const isShortTitle = line.length < 80 && i > 0 && lines[i - 1].trim() === "";
      
      if (isAllCaps || (isShortTitle && line.length > 10)) {
        // Check if next line is not empty (likely a heading followed by content)
        if (i < lines.length - 1 && lines[i + 1].trim() !== "") {
          isChapterHeading = true;
        }
      }
    }
    
    if (isChapterHeading && currentChapter.content.length > 0) {
      // Save current chapter
      currentChapter.endIndex = i;
      currentChapter.content = lines.slice(currentChapter.startIndex, i).join("\n");
      chapters.push({ ...currentChapter });
      
      // Start new chapter
      chapterIndex++;
      currentChapter = {
        title: line,
        startIndex: i,
        content: [],
        chapterIndex
      };
    } else {
      currentChapter.content.push(line);
    }
  }
  
  // Add final chapter
  if (currentChapter.content.length > 0) {
    currentChapter.endIndex = lines.length;
    currentChapter.content = lines.slice(currentChapter.startIndex).join("\n");
    chapters.push(currentChapter);
  }
  
  // If no chapters detected, split by page breaks or paragraph groups
  if (chapters.length <= 1) {
    return splitByParagraphs(text);
  }
  
  return chapters;
}

/**
 * Split content by paragraphs when no chapter headings are detected
 */
function splitByParagraphs(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chapters = [];
  const paragraphsPerChapter = 15; // Group every 15 paragraphs into a chapter
  
  for (let i = 0; i < paragraphs.length; i += paragraphsPerChapter) {
    const chapterParagraphs = paragraphs.slice(i, i + paragraphsPerChapter);
    chapters.push({
      title: `Chapter ${Math.floor(i / paragraphsPerChapter) + 1}`,
      content: chapterParagraphs.join("\n\n"),
      chapterIndex: Math.floor(i / paragraphsPerChapter)
    });
  }
  
  return chapters;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Convert plain text to XHTML with proper formatting
 */
function textToXhtml(text, title, chapterNumber, language = "en") {
  const fontFamily = language === "si" 
    ? "'Noto Serif Sinhala', 'Iskoola Pota', serif" 
    : "serif";
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // If no double line breaks, split by single line breaks
  if (paragraphs.length === 1) {
    const lines = text.split(/\n/).filter(l => l.trim().length > 0);
    const xhtmlParagraphs = lines.map(line => {
      const trimmed = line.trim();
      // Check if it might be a heading (short line, possibly all caps)
      if (trimmed.length < 100 && (trimmed === trimmed.toUpperCase() || trimmed.length < 60)) {
        return `        <h2>${escapeHtml(trimmed)}</h2>`;
      }
      return `        <p>${escapeHtml(trimmed)}</p>`;
    });
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>${escapeHtml(title)}</title>
    <style type="text/css">
        body { font-family: ${fontFamily}; margin: 1em; line-height: 1.6; }
        h1, h2 { margin-top: 1em; margin-bottom: 0.5em; }
        p { margin: 0.5em 0; text-align: justify; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
${xhtmlParagraphs.join("\n")}
</body>
</html>`;
  }
  
  const xhtmlParagraphs = paragraphs.map(para => {
    const trimmed = para.trim();
    // Check if paragraph might be a heading
    if (trimmed.length < 100 && trimmed.split(/\s+/).length < 10) {
      return `        <h2>${escapeHtml(trimmed)}</h2>`;
    }
    return `        <p>${escapeHtml(trimmed)}</p>`;
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>${escapeHtml(title)}</title>
    <style type="text/css">
        body { font-family: ${fontFamily}; margin: 1em; line-height: 1.6; }
        h1, h2 { margin-top: 1em; margin-bottom: 0.5em; }
        p { margin: 0.5em 0; text-align: justify; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
${xhtmlParagraphs.join("\n")}
</body>
</html>`;
}

/**
 * Generate content.opf file
 */
function generateContentOpf(chapters, language, bookTitle = "Book") {
  const lang = language === "si" ? "si" : "en";
  const items = [];
  const itemrefs = [];
  
  // Cover page
  items.push('    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
  itemrefs.push('    <itemref idref="cover"/>');
  
  // Navigation file (EPUB 3)
  items.push('    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  
  // Chapter files
  chapters.forEach((chapter, index) => {
    const id = `chapter-${index + 1}`;
    const href = `chapter-${index + 1}.xhtml`;
    items.push(`    <item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    itemrefs.push(`    <itemref idref="${id}"/>`);
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="book-id">urn:uuid:${generateUUID()}</dc:identifier>
        <dc:title>${escapeHtml(bookTitle)}</dc:title>
        <dc:language>${lang}</dc:language>
        <dc:creator>Unknown</dc:creator>
        <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    </metadata>
    <manifest>
${items.join("\n")}
    </manifest>
    <spine toc="ncx">
${itemrefs.join("\n")}
    </spine>
</package>`;
}

/**
 * Generate toc.ncx file (EPUB 2 navigation)
 */
function generateTocNcx(chapters, bookTitle = "Book") {
  const navPoints = chapters.map((chapter, index) => {
    return `        <navPoint id="navpoint-${index + 1}" playOrder="${index + 2}">
            <navLabel>
                <text>${escapeHtml(chapter.title)}</text>
            </navLabel>
            <content src="chapter-${index + 1}.xhtml"/>
        </navPoint>`;
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:${generateUUID()}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${escapeHtml(bookTitle)}</text>
    </docTitle>
    <navMap>
        <navPoint id="navpoint-0" playOrder="1">
            <navLabel>
                <text>Cover</text>
            </navLabel>
            <content src="cover.xhtml"/>
        </navPoint>
${navPoints.join("\n")}
    </navMap>
</ncx>`;
}

/**
 * Generate nav.xhtml file (EPUB 3 navigation)
 */
function generateNavXhtml(chapters, bookTitle = "Book") {
  const navItems = chapters.map((chapter, index) => {
    return `            <li><a href="chapter-${index + 1}.xhtml">${escapeHtml(chapter.title)}</a></li>`;
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>Navigation</title>
</head>
<body>
    <nav epub:type="toc">
        <h1>Table of Contents</h1>
        <ol>
            <li><a href="cover.xhtml">Cover</a></li>
${navItems.join("\n")}
        </ol>
    </nav>
</body>
</html>`;
}

/**
 * Generate cover page XHTML
 */
function generateCoverXhtml(bookTitle = "Book") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <meta charset="UTF-8"/>
    <title>Cover</title>
    <style type="text/css">
        body { 
            margin: 0; 
            padding: 0; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            text-align: center;
            font-family: serif;
        }
        h1 { font-size: 2.5em; margin: 1em; }
    </style>
</head>
<body>
    <div>
        <h1>${escapeHtml(bookTitle)}</h1>
    </div>
</body>
</html>`;
}

/**
 * Generate a simple UUID
 */
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extract text from DOCX file
 */
async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Extract text from file based on extension
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".pdf") {
    return await extractTextFromPdf(filePath);
  } else if (ext === ".docx" || ext === ".doc") {
    return await extractTextFromDocx(filePath);
  } else {
    // Try to read as plain text
    return fs.readFileSync(filePath, "utf-8");
  }
}

/**
 * Main conversion function
 */
exports.convert = async (input, output, language) => {
  try {
    // Extract text from input file
    console.log(`Extracting text from ${input}...`);
    const text = await extractText(input);
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text content extracted from file");
    }
    
    // Detect chapters
    console.log("Detecting chapters...");
    const chapters = detectChapters(text);
    console.log(`Found ${chapters.length} chapters`);
    
    // Generate book title from filename
    const bookTitle = path.basename(input, path.extname(input));
    
    // Create EPUB structure
    const zip = new JSZip();
    
    // Add mimetype (must be first, uncompressed)
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    
    // Create META-INF directory
    const metaInf = zip.folder("META-INF");
    metaInf.file("container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);
    
    // Create OEBPS directory
    const oebps = zip.folder("OEBPS");
    
    // Generate cover page
    oebps.file("cover.xhtml", generateCoverXhtml(bookTitle));
    
    // Generate chapter XHTML files
    chapters.forEach((chapter, index) => {
      const xhtml = textToXhtml(chapter.content, chapter.title, index + 1, language);
      oebps.file(`chapter-${index + 1}.xhtml`, xhtml);
    });
    
    // Generate content.opf
    oebps.file("content.opf", generateContentOpf(chapters, language, bookTitle));
    
    // Generate toc.ncx (EPUB 2)
    oebps.file("toc.ncx", generateTocNcx(chapters, bookTitle));
    
    // Generate nav.xhtml (EPUB 3)
    oebps.file("nav.xhtml", generateNavXhtml(chapters, bookTitle));
    
    // Generate EPUB file
    console.log(`Generating EPUB file: ${output}...`);
    const epubBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    });
    
    fs.writeFileSync(output, epubBuffer);
    console.log(`EPUB generated successfully: ${output}`);
  } catch (error) {
    console.error("Error during conversion:", error);
    throw error;
  }
};
