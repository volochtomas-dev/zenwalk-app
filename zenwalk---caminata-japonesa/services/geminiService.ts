import { GoogleGenAI } from "@google/genai";
import { MindfulnessTip } from "../types";

// Frases de respaldo por si no hay API Key o falla la conexión
const FALLBACK_TIPS = [
  "Camina como si tus pies besaran la tierra.",
  "Respira profundo: el aire es tu alimento.",
  "No cuentes los pasos, siente cada uno.",
  "Tu ritmo es el ritmo del universo ahora mismo.",
  "Deja tus preocupaciones en el paso que acabas de dar.",
  "La naturaleza no se apresura, y sin embargo todo se cumple.",
  "Siente la gravedad anclándote al momento presente.",
  "Observa tu respiración, es el ancla de tu mente.",
  "Caminar es meditar en movimiento.",
  "Sé consciente del espacio que ocupas en el mundo."
];

// Intentamos iniciar la IA solo si existe la clave, si no, usamos modo offline
let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (e) {
  console.log("Modo offline activado");
}

export const getMindfulnessTip = async (): Promise<MindfulnessTip> => {
  // Si no hay IA configurada, devolvemos una frase aleatoria local
  if (!ai) {
    return getLocalTip();
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Genera una frase corta, motivadora y zen sobre caminar, la naturaleza o la respiración consciente, en español. Formato JSON simple con campo 'text'.",
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return getLocalTip();

    const parsed = JSON.parse(text);
    return {
      text: parsed.text || "Camina con propósito.",
      author: parsed.author || "ZenWalk AI"
    };
  } catch (error) {
    console.error("Error fetching tip, using fallback:", error);
    return getLocalTip();
  }
};

const getLocalTip = (): MindfulnessTip => {
  const randomIndex = Math.floor(Math.random() * FALLBACK_TIPS.length);
  return { 
    text: FALLBACK_TIPS[randomIndex],
    author: "Sabiduría Zen"
  };
};