
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Flashcard, DocumentAnalysis } from "../types";

const GENERATION_MODEL = "gemini-2.5-flash"; 
const IMAGE_MODEL = "gemini-2.5-flash-image"; // Dedicated model for editing
const ANALYSIS_MODEL = "gemini-2.5-flash";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const normalizeMimeType = (mimeType: string): string => {
  // strictly normalize common image types to standard IANA media types
  const lower = mimeType.toLowerCase();
  if (lower === 'image/jpg' || lower.includes('jpeg')) return 'image/jpeg';
  if (lower === 'image/png') return 'image/png';
  if (lower === 'image/webp') return 'image/webp';
  return mimeType;
};

/**
 * Step 1: Analyze the document to get metadata and recommendations
 */
export const analyzeDocument = async (
  fileBase64: string,
  mimeType: string
): Promise<DocumentAnalysis> => {
  const ai = getAiClient();
  const safeMimeType = normalizeMimeType(mimeType);

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      language: { type: Type.STRING, description: "The primary language of the document" },
      topic: { type: Type.STRING, description: "The main medical topic" },
      suggestedCount: { type: Type.INTEGER, description: "Recommended number of cards based on information density (between 10 and 100)" },
      reasoning: { type: Type.STRING, description: "Short explanation for the card count recommendation." },
      hasImages: { type: Type.BOOLEAN, description: "True if the document contains images, diagrams, or if the file itself is an image." },
      imageCountEstimate: { type: Type.STRING, description: "Estimated number of images found (e.g. '5', '10-20', '1')." }
    },
    required: ["language", "topic", "suggestedCount", "reasoning", "hasImages", "imageCountEstimate"],
  };

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: safeMimeType, data: fileBase64 } },
          { text: "Analyze this medical file. Identify the language and main clinical/scientific topic. Report if it contains diagrams or is an image itself. Estimate the optimal number of flashcards needed (range 10-100)." },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Analysis failed: No content returned.");
    return JSON.parse(jsonText) as DocumentAnalysis;

  } catch (error: any) {
    console.error("Analysis Error:", error);
    // Fallback defaults if analysis fails
    return {
      language: "English",
      topic: "General Medicine",
      suggestedCount: 30,
      reasoning: "Analysis failed, using defaults.",
      hasImages: false,
      imageCountEstimate: "0"
    };
  }
};

/**
 * Step 2: Generate Clean Plate (AI Image Editing)
 * Asks the AI to remove text labels from the image.
 */
export const generateAiCleanPlate = async (
  fileBase64: string,
  mimeType: string
): Promise<{ data: string; mimeType: string }> => {
  const ai = getAiClient();
  const safeMimeType = normalizeMimeType(mimeType);
  
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: safeMimeType, data: fileBase64 } },
          // UPDATED PROMPT: Preservation + Removal
          { text: `
            You are a specialized Medical Image Editor.
            
            TASK: Remove text labels to create a "Fill-in-the-blank" study image.
            
            STRICT RULES:
            1. OUTPUT THE EXACT SAME IMAGE LAYOUT. Do not crop, resize, or hallucinate new layouts.
            2. PRESERVE ALL ANATOMY. Do not remove organs, tissues, or inset diagrams.
            3. PRESERVE LINES WHERE POSSIBLE. Try to keep the thin leader lines.
            4. REMOVE TEXT. Inpaint the text characters with the background color.
            
            If a text label overlaps a line, it is acceptable to erase the part of the line touching the text, but try to leave the rest of the line.
            My system will redraw pointers if needed, so prioritize CLEAN TEXT REMOVAL.
            ` },
        ],
      },
      config: {
        temperature: 0.0, // Force deterministic output
      }
    });

    // Extract the image part from the response
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          };
        }
      }
    }
    
    throw new Error("AI did not return an image.");

  } catch (error: any) {
    console.error("Clean Plate Generation Error:", error);
    // If AI generation fails, return original as fallback
    return { data: fileBase64, mimeType: safeMimeType }; 
  }
};

/**
 * Step 3: Generate cards/coordinates based on analysis
 */
export const generateFlashcardsFromDocument = async (
  fileBase64: string,
  mimeType: string,
  preferences: {
    examType: string;
    focusArea: string;
    cardCount: number;
    language: string;
  }
): Promise<{ cards: Flashcard[] }> => {
  const ai = getAiClient();
  const safeMimeType = normalizeMimeType(mimeType);
  const { examType, focusArea, cardCount, language } = preferences;
  const isImageFile = mimeType.startsWith('image/');

  const systemInstruction = `
    You are a specialized Medical Education AI.
    
    CONTEXT:
    The input is ${isImageFile ? "a MEDICAL DIAGRAM." : "a medical document."}

    ${isImageFile ? `
    **TASK: IDENTIFY FLASHCARD TARGETS**
    - Identify the ${cardCount} most clinically relevant anatomical structures labeled in the image.
    - For each target, provide TWO bounding boxes:
      1. 'boundingBox': The box around the **TEXT LABEL**.
      2. 'structureBoundingBox': The box around the **ANATOMICAL STRUCTURE** it points to.
    
    **FLASHCARD CONTENT**:
    - **Front**: "Structure #?" (Placeholder)
    - **Back**: Name of the structure & a high-yield clinical fact.
    ` : `
    DOCUMENT INSTRUCTIONS:
    - Extract high-yield ${examType} concepts.
    - Create professional Anki cards.
    `}
    
    LANGUAGE: ${language}.
    
    OUTPUT SCHEMA:
    - 'flashcards': List of items for testing.
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      flashcards: {
        type: Type.ARRAY,
        description: "A list of generated flashcards.",
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING, description: "Question placeholder" },
            back: { type: Type.STRING, description: "Name of structure and explanation" },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            boundingBox: { 
                type: Type.ARRAY, 
                description: "Coordinates [ymin, xmin, ymax, xmax] of the TEXT LABEL.",
                items: { type: Type.NUMBER }
            },
            structureBoundingBox: {
                type: Type.ARRAY,
                description: "Coordinates [ymin, xmin, ymax, xmax] of the ANATOMICAL STRUCTURE.",
                items: { type: Type.NUMBER }
            }
          },
          required: ["front", "back", "tags"],
        },
      }
    },
    required: ["flashcards"]
  };

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: safeMimeType, data: fileBase64 } },
          { text: `Generate flashcards for ${examType}. Focus: ${focusArea}. Language: ${language}.` },
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No content generated.");

    const data = JSON.parse(jsonText);
    const rawCards = data.flashcards || [];

    const processedCards = rawCards.map((card: any, index: number) => ({
      id: `card-${Date.now()}-${index}`,
      front: card.front,
      back: card.back,
      tags: card.tags || [],
      boundingBox: card.boundingBox || undefined,
      structureBoundingBox: card.structureBoundingBox || undefined,
    }));

    return { cards: processedCards };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate flashcards.");
  }
};
