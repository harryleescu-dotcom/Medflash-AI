import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Flashcard, DocumentAnalysis } from "../types";

const GENERATION_MODEL = "gemini-3-pro-preview"; // Best for complex generation
const ANALYSIS_MODEL = "gemini-2.5-flash"; // Fast for initial scan

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Step 1: Analyze the document to get metadata and recommendations
 */
export const analyzeDocument = async (
  fileBase64: string,
  mimeType: string
): Promise<DocumentAnalysis> => {
  const ai = getAiClient();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      language: { type: Type.STRING, description: "The primary language of the document (e.g. 'English', 'Traditional Chinese', 'Spanish')" },
      topic: { type: Type.STRING, description: "The main medical topic (e.g. 'Cardiology', 'Pharmacology')" },
      suggestedCount: { type: Type.INTEGER, description: "Recommended number of cards based on information density (between 10 and 100)" },
      reasoning: { type: Type.STRING, description: "Short explanation for the card count recommendation" },
    },
    required: ["language", "topic", "suggestedCount", "reasoning"],
  };

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: fileBase64 } },
          { text: "Analyze this medical document. Identify the language, main topic, and estimate the optimal number of flashcards needed to cover the high-yield content thoroughly (range 10-100)." },
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
    };
  }
};

/**
 * Step 2: Generate cards based on analysis and user preferences
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
): Promise<Flashcard[]> => {
  const ai = getAiClient();
  const { examType, focusArea, cardCount, language } = preferences;

  const systemInstruction = `
    You are a world-class medical tutor and Anki card expert specializing in ${examType}.
    
    YOUR GOAL:
    Extract high-yield concepts from the provided document and convert them into Anki-style flashcards.

    LANGUAGE RULE:
    - **Strictly** generate the content (Questions and Answers) in **${language}**.
    - Use the terminology found in the source text.
    
    FORMATTING RULES (CRITICAL FOR ANKI):
    1. **Subscripts/Superscripts:** You MUST use HTML tags for chemical formulas, isotopes, or exponents.
       - Correct: CO<sub>2</sub>, O<sub>2</sub>, Ca<sup>2+</sup>, 10<sup>6</sup>.
       - Incorrect: CO2, Ca2+.
    2. **Symbols:** Use direct Unicode characters for Greek letters and math symbols.
       - Examples: α (alpha), β (beta), γ (gamma), Δ (delta), μ (micro), → (arrow), ↑, ↓.
    3. **Bold:** Use <b>text</b> for emphasis.
    
    CONTENT RULES:
    1. Focus on HIGH YIELD facts suitable for medical board exams.
    2. Pay special attention to highlighted, bolded, or red-text annotations.
    3. Front of card: Clear question or vignette.
    4. Back of card: Concise answer.
    
    OUTPUT:
    - Return a JSON array of objects.
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    description: "A list of generated flashcards",
    items: {
      type: Type.OBJECT,
      properties: {
        front: { type: Type.STRING },
        back: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["front", "back", "tags"],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: fileBase64 } },
          { text: `Generate exactly ${cardCount} flashcards for ${examType}. Topic: ${focusArea}. Language: ${language}. Ensure all scientific notation uses HTML tags (<sub>, <sup>) and Greek symbols use Unicode.` },
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.3,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No content generated.");

    const data = JSON.parse(jsonText);
    
    return data.map((card: any, index: number) => ({
      id: `card-${Date.now()}-${index}`,
      front: card.front,
      back: card.back,
      tags: card.tags || [],
    }));

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate flashcards.");
  }
};
