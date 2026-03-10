import { GoogleGenAI, Type } from "@google/genai";
import { HealthReport } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return aiInstance;
};

export const analyzeHealthResult = async (rawText: string, userProfile: { age: number, gender: string }): Promise<HealthReport> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `
      Analyze the following health checkup data for a ${userProfile.age} year old ${userProfile.gender}.
      
      Raw Data:
      ${rawText}
      
      Please provide a structured analysis in JSON format.
      The output should include:
      - overallScore (0-100)
      - summary (A concise, friendly summary of the health status)
      - metrics (An array of objects with: name, value, unit, referenceRange, status [normal|caution|danger], description, category)
      - actionPlan (diet, exercise, medical recommendations)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          metrics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                referenceRange: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["normal", "caution", "danger"] },
                description: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["liver", "kidney", "blood", "metabolism", "other"] }
              },
              required: ["name", "value", "unit", "referenceRange", "status", "description", "category"]
            }
          },
          actionPlan: {
            type: Type.OBJECT,
            properties: {
              diet: { type: Type.ARRAY, items: { type: Type.STRING } },
              exercise: { type: Type.ARRAY, items: { type: Type.STRING } },
              medical: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        },
        required: ["overallScore", "summary", "metrics", "actionPlan"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    ...result,
    id: Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString(),
  };
};

export const simulateOCR = async (imageData: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      { text: "Extract all health checkup metrics and their values from this image. Return them as a clean text list." },
      { inlineData: { mimeType: "image/jpeg", data: imageData.split(",")[1] } }
    ]
  });
  return response.text || "";
};
