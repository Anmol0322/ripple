import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

const CSRF_SECRET = process.env.CSRF_SECRET || "ripple-static-csrf-secret";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers["x-csrf-token"];
  if (!token || token !== CSRF_SECRET) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  if (!ai) return res.status(503).json({ error: "Gemini API is not configured" });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const history = messages.map((m: any) => ({
    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
    parts: [{ text: m.content || m.text || "" }],
  }));

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction:
        "You are Gemini, a helpful AI assistant integrated into a collaborative chat app named Ripple. Keep answers concise, friendly, and markdown-formatted.",
    },
    history: history.slice(0, -1),
  });

  try {
    const lastMessage = history[history.length - 1]?.parts[0]?.text || "Hello";
    const response = await chat.sendMessage({ message: lastMessage });
    return res.json({ text: response.text });
  } catch {
    return res.status(500).json({ error: "Failed to generate AI response" });
  }
}
