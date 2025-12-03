import { Flashcard } from "../types";

export const downloadAnkiCsv = (cards: Flashcard[], filename: string) => {
  // Anki CSV format: "Front","Back","Tags"
  // Fields with newlines or commas must be quoted.
  // HTML line breaks <br> are often better for Anki than literal newlines, but literal newlines in quotes work too.
  
  const escapeCsvField = (field: string) => {
    // Replace double quotes with double-double quotes for CSV escaping
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const csvContent = cards.map(card => {
    const front = escapeCsvField(card.front);
    const back = escapeCsvField(card.back);
    // Join tags with spaces (standard Anki format) or separate column? 
    // Usually Anki import allows mapping columns. We will put tags in the 3rd column.
    const tags = escapeCsvField(card.tags.join(" "));
    return `${front},${back},${tags}`;
  }).join("\n");

  // Add BOM for Excel/Unicode compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_anki_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
