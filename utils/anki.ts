import { Flashcard } from "../types";

// Helper to escape fields for TSV/CSV
// Note: For TSV, we mainly need to ensure tabs and newlines are handled.
// Anki allows HTML, so we replace newlines with <br>.
const formatFieldForAnki = (field: string) => {
  if (!field) return "";
  // Replace newlines with <br> for Anki
  let formatted = field.replace(/\n/g, '<br>');
  // Remove tabs from content to avoid breaking TSV structure
  formatted = formatted.replace(/\t/g, '    '); 
  return formatted;
};

/**
 * Download simple Text file (for Mobile Import - Text Only)
 */
export const downloadMobileText = (cards: Flashcard[], filename: string) => {
  // Format: Front <tab> Back <tab> Tags
  const content = cards.map(card => {
    const front = formatFieldForAnki(card.front);
    const back = formatFieldForAnki(card.back);
    const tags = card.tags.join(" ");
    return `${front}\t${back}\t${tags}`;
  }).join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_mobile_import.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download Markdown (for Obsidian/Notion)
 */
export const downloadMarkdown = (cards: Flashcard[], filename: string) => {
  const content = cards.map(card => {
    return `### ${card.front}\n\n**Answer:** ${card.back}\n\n*Tags: #${card.tags.join(" #")}*\n\n---\n`;
  }).join("\n");

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_notes.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * ZIP Export (Images + TSV) - Flatted structure for Mobile compatibility
 */
export const downloadAnkiPack = async (cards: Flashcard[], filename: string) => {
  if (!window.JSZip) {
    alert("ZIP library not loaded. Please refresh.");
    return;
  }

  const zip = new window.JSZip();
  // REMOVED: const imgFolder = zip.folder("media_files"); 
  // We now put everything in root to avoid "File not found" errors on some importers
  
  // 1. Process Cards & Add Images to Zip
  const tsvRows = cards.map((card, index) => {
    let frontContent = card.front;
    
    // Process formatting first
    frontContent = formatFieldForAnki(frontContent);
    let backContent = formatFieldForAnki(card.back);
    
    if (card.image) {
      // 1. Get raw base64 (strip data:image/png;base64,)
      const base64Data = card.image.split(',')[1];
      const imgExt = "png"; 
      // Create a unique safe filename for Anki
      const imgFileName = `medflash_${Date.now()}_${index}.${imgExt}`;
      
      // 2. Add to Zip ROOT
      zip.file(imgFileName, base64Data, { base64: true });
      
      // 3. Update Front to use standard Anki Image tag
      // Anki looks for images in its collection.media folder.
      frontContent += `<br><br><img src="${imgFileName}">`; 
    }

    const tags = card.tags.join(" ");
    
    // Return Tab Separated Row
    return `${frontContent}\t${backContent}\t${tags}`;
  });

  const tsvContent = tsvRows.join("\n");
  
  // 2. Add TSV to Zip ROOT
  zip.file("import.txt", tsvContent);
  
  // 3. Add Instructions
  const instructions = `
IMPORT INSTRUCTIONS (MEDFLASH AI)
=================================

METHOD A: ANKI DESKTOP (Recommended)
1. Unzip this folder.
2. Select all .png image files and move them to your "collection.media" folder.
3. Open Anki -> File -> Import -> Select "import.txt".
4. Sync to your mobile device.

METHOD B: DIRECT IMPORT (Some Mobile Apps)
1. Some mobile apps support importing this ZIP directly if they handle media archives.
2. If getting "Error 500", please use Method A.

File Structure:
- import.txt (Flashcards)
- *.png (Images)
  `;
  zip.file("README.txt", instructions);

  // 4. Generate and Download
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_anki_pack.zip`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};