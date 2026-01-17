import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Task } from "../types";

export class GeminiService {
  async analyzeTasks(tasks: Task[], userName: string) {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    try {
      // Use ai.models.generateContent with gemini-2.5-flash for faster response and higher rate limits.
      // Explicitly typing the response and using thinkingConfig for detailed workflow analysis.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze these tasks for ${userName}: ${JSON.stringify(tasks)}`,
        config: {
          systemInstruction: `
            You are Saathi AI, an intelligent task management companion for the app 'TaskSetu'.
            Provide:
            1. A professional summary of urgent tasks.
            2. Constructive suggestions for better workflow.
            3. A polite and professional draft for a WhatsApp reminder message in an Indian business context.
          `,
          // Gemini 3 series supports thinkingConfig. Max budget for gemini-3-pro-preview is 32768.
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });
      // Direct access to the .text property (not a method) as per guidelines.
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "I'm experiencing a momentary lapse in my circuits. Please give me a second and try again!";
    }
  }

  async chatWithBot(message: string, context: { tasks: Task[], user: string }) {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    try {
      // Use ai.models.generateContent with gemini-2.5-flash to ensure high-quality reasoning and warm persona consistency.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `User Message: "${message}"`,
        config: {
          systemInstruction: `
            Persona: Saathi AI, an intelligent and friendly assistant for the 'TaskSetu' app.
            Context: Current user is ${context.user}.
            Task Context: ${JSON.stringify(context.tasks)}.
            Instructions: Be helpful, professional, and warm (Indian professional tone). You can help find tasks, set reminders, or provide productivity tips. Keep it concise.
          `
        }
      });
      // Direct access to the .text property.
      return response.text;
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "I am unable to respond right now. Please check your internet connection.";
    }
  }
}

export const geminiService = new GeminiService();