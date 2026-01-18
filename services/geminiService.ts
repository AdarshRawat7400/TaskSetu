import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Task } from "../types";

export class GeminiService {
  private handleGeminiError(error: any): string {
    const errorStr = String(error).toLowerCase();
    if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("resource exhausted")) {
      return "Not available at the moment";
    }
    console.error("Gemini Error:", error);
    return "I'm experiencing a momentary lapse in my circuits. Please give me a second and try again!";
  }

  async analyzeTasks(tasks: Task[], userName: string) {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    try {
      // Use ai.models.generateContent with gemini-2.0-flash-exp as fallback for gemma-3-12b (404 Not Found)
      // Explicitly typing the response.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: `Analyze these tasks for ${userName}: ${JSON.stringify(tasks)}`,
        config: {
          systemInstruction: `
            You are Saathi AI, an intelligent task management companion for the app 'TaskSetu'.
            Provide:
            1. A professional summary of urgent tasks.
            2. Constructive suggestions for better workflow.
            3. A polite and professional draft for a WhatsApp reminder message in an Indian business context.
          `,
        }
      });
      // Direct access to the .text property (not a method) as per guidelines.
      return response.text;
    } catch (error) {
      return this.handleGeminiError(error);
    }
  }

  async chatWithBot(message: string, context: { tasks: Task[], user: string }) {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    try {
      // Use gemini-2.0-flash-exp as reliable fall back.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
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
      const errMsg = this.handleGeminiError(error);
      return errMsg === "Not available at the moment" ? errMsg : "I am unable to respond right now. Please check your internet connection.";
    }
  }

  async analyzeDocument(base64Data: string, mimeType: string): Promise<Partial<Task> | null> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            parts: [
              { text: "Extract the following task details from this document and return them as a valid JSON object: title (string), description (string), priority ('low'|'medium'|'high'|'urgent'), and dueDate (YYYY-MM-DD format, infer from context if needed, e.g. 'next friday'). If a field cannot be found, omit it or use null." },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text; // Property, not method
      if (!text) return null;

      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);

    } catch (e) {
      const errorStr = String(e).toLowerCase();
      if (errorStr.includes("429") || errorStr.includes("quota")) {
        // We throw so the caller knows specifically it was a quota issue to show the toast
        throw new Error("Not available at the moment");
      }
      console.error("Gemini Document Analysis Failed:", e);
      return null;
    }
  }
}


export const geminiService = new GeminiService();