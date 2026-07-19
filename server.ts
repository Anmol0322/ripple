import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), "active-spreadsheet.json");
const LOCAL_DB_PATH = path.join(process.cwd(), "local-db.json");

function sanitizeLog(input: any): string {
  return String(input).replace(/[\r\n]/g, " ").substring(0, 200);
}

function isAllowedSheetsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "sheets.googleapis.com" ||
        parsed.hostname === "www.googleapis.com") &&
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function loadLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load local-db.json");
  }

  const nowString = new Date().toISOString();
  return {
    Messages: [
      [
        "msg-welcome",
        "ai-chat",
        "system",
        "Gemini AI",
        "bot@sheetschat.internal",
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80",
        "Hey! 👋 Welcome to Ripple. Ask me anything to start chatting!",
        nowString,
        "",
      ],
    ],
    Rooms: [
      ["ai-chat", "ai-chat", "Talk to Gemini AI assistant here! (Type anything or ask questions)", "System", nowString],
    ],
    Users: [],
  };
}

function saveLocalDb(db: any) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save local-db.json");
  }
}

let adminAccessToken = "";
let activeConfig: any = null;

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    adminAccessToken = data.adminAccessToken || "";
    activeConfig = data.spreadsheetConfig || null;
    console.log("Loaded active spreadsheet configuration:", sanitizeLog(activeConfig?.spreadsheetId));
  }
} catch (e) {
  console.error("Failed to load active-spreadsheet.json on startup");
}

async function startServer() {
  const app = express();
  const PORT = 3010;

  app.use(express.json());

  // CSRF protection via double-submit token
  const CSRF_SECRET = crypto.randomBytes(32).toString("hex");
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const token = req.headers["x-csrf-token"];
    if (!token || token !== CSRF_SECRET) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    next();
  });
  app.get("/api/csrf-token", (req, res) => res.json({ token: CSRF_SECRET }));

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

  // Endpoint for Admins to register or refresh their active database and OAuth token
  app.post("/api/admin/register", (req, res) => {
    try {
      const { accessToken, spreadsheetConfig } = req.body;
      if (!accessToken || !spreadsheetConfig) {
        return res.status(400).json({ error: "Missing accessToken or spreadsheetConfig" });
      }

      adminAccessToken = accessToken;
      activeConfig = spreadsheetConfig;

      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify({ adminAccessToken, spreadsheetConfig }, null, 2),
        "utf8"
      );

      console.log("Registered active spreadsheet database:", sanitizeLog(spreadsheetConfig.spreadsheetId));
      return res.json({ success: true, activeConfig });
    } catch (e: any) {
      console.error("Failed to save active-spreadsheet.json");
      return res.status(500).json({ error: "Failed to persist spreadsheet config on server" });
    }
  });

  // Endpoint for any client to fetch the active spreadsheet configuration
  app.get("/api/active-spreadsheet", (req, res) => {
    return res.json({
      spreadsheetConfig: activeConfig,
      hasAdminToken: !!adminAccessToken,
    });
  });

  // Google Sheets API Proxy for guests/members who do not have their own Google credentials
  app.post("/api/sheets/proxy", async (req, res) => {
    const { method, path: apiPath, body, query } = req.body;
    const targetSpreadsheetId = req.body.spreadsheetId || activeConfig?.spreadsheetId;
    const clientToken = req.headers.authorization?.split(" ")[1];
    const tokenToUse =
      clientToken && clientToken !== "null" && clientToken !== "undefined" && clientToken !== "PROXY"
        ? clientToken
        : adminAccessToken;

    const useLocalFallback = (reason: string) => {
      const db = loadLocalDb();

      if (apiPath && apiPath.includes("batchUpdate")) {
        if (body && Array.isArray(body.data)) {
          body.data.forEach((item: any) => {
            const range = item.range || "";
            const values = item.values || [];
            if (range.startsWith("Messages")) {
              if (range.includes("A1") || range.includes("A2")) db.Messages = values;
            } else if (range.startsWith("Rooms")) {
              if (range.includes("A1") || range.includes("A2")) db.Rooms = values;
            } else if (range.startsWith("Users")) {
              if (range.includes("A1") || range.includes("A2")) db.Users = values;
            }
          });
          saveLocalDb(db);
        }
        return res.json({ spreadsheetId: targetSpreadsheetId || "local", spreadsheetUrl: "" });
      }

      let sheetName = "";
      if (apiPath && apiPath.includes("Messages")) sheetName = "Messages";
      else if (apiPath && apiPath.includes("Rooms")) sheetName = "Rooms";
      else if (apiPath && apiPath.includes("Users")) sheetName = "Users";

      if (!sheetName) {
        return res.status(400).json({ error: "Unknown sheet path" });
      }

      const isAppend = apiPath && apiPath.includes("append");
      const isGet = !method || method === "GET";
      const isPut = method === "PUT";

      if (isGet) {
        let valuesToReturn = db[sheetName] || [];
        if (apiPath && !apiPath.includes("A2")) {
          let headers: string[] = [];
          if (sheetName === "Messages") headers = ["id", "roomId", "userId", "userName", "userEmail", "userPhoto", "text", "timestamp", "replyToId"];
          else if (sheetName === "Rooms") headers = ["id", "name", "description", "createdBy", "createdAt"];
          else if (sheetName === "Users") headers = ["id", "name", "email", "photoUrl", "status", "lastActive"];
          valuesToReturn = [headers, ...valuesToReturn];
        }
        return res.json({ values: valuesToReturn });
      }

      if (isAppend) {
        if (body && Array.isArray(body.values)) {
          body.values.forEach((row: any) => {
            if (sheetName === "Users") {
              const userId = row[0];
              const idx = db.Users.findIndex((u: any) => u[0] === userId);
              if (idx !== -1) db.Users[idx] = row;
              else db.Users.push(row);
            } else if (sheetName === "Rooms") {
              const roomId = row[0];
              if (!db.Rooms.some((r: any) => r[0] === roomId)) db.Rooms.push(row);
            } else {
              db.Messages.push(row);
            }
          });
          saveLocalDb(db);
        }
        return res.json({ success: true });
      }

      if (isPut) {
        if (body && Array.isArray(body.values) && body.values[0]) {
          const row = body.values[0];
          const userId = row[0];
          const idx = db.Users.findIndex((u: any) => u[0] === userId);
          if (idx !== -1) db.Users[idx] = row;
          else db.Users.push(row);
          saveLocalDb(db);
        }
        return res.json({ success: true });
      }

      return res.status(400).json({ error: "Method not implemented for fallback." });
    };

    if (!tokenToUse || tokenToUse === "PROXY") {
      return useLocalFallback("No authorized access token available.");
    }

    try {
      // Validate spreadsheetId — only alphanumeric, hyphens, underscores
      if (!targetSpreadsheetId || !/^[a-zA-Z0-9_-]+$/.test(targetSpreadsheetId)) {
        return useLocalFallback("Invalid spreadsheet ID.");
      }

      // Validate apiPath — only safe sheet path characters
      if (!apiPath || !/^[a-zA-Z0-9!:@.%+_\-]+$/.test(apiPath)) {
        return res.status(400).json({ error: "Invalid API path" });
      }

      let url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${apiPath}`;
      if (query && Object.keys(query).length > 0) {
        const qParams = new URLSearchParams(query).toString();
        if (qParams) url += `?${qParams}`;
      }

      if (!isAllowedSheetsUrl(url)) {
        return res.status(400).json({ error: "Disallowed target URL" });
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${tokenToUse}`,
        "Content-Type": "application/json",
      };

      const options: RequestInit = { method: method || "GET", headers };
      if (body) options.body = JSON.stringify(body);

      const googleRes = await fetch(url, options);

      if (!googleRes.ok) {
        if (googleRes.status === 401 || googleRes.status === 403) {
          return useLocalFallback("Session expired");
        }
        return res.status(googleRes.status).json({ error: "Request unsuccessful" });
      }

      const responseData = await googleRes.json();
      return res.json(responseData);
    } catch (error: any) {
      console.error("Sheets proxy error");
      return useLocalFallback("Fetch exception");
    }
  });

  // API Route for Gemini
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({ error: "Gemini API is not configured on the server" });
      }

      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const history = messages.map((m: any) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content || m.text || "" }],
      }));

      const model = "gemini-3.5-flash";
      const systemInstruction =
        "You are Gemini, a helpful AI assistant integrated into a collaborative chat application named Ripple. " +
        "Keep your answers concise, friendly, and markdown-formatted. " +
        "You can refer to users and rooms as they are passed to you.";

      const chat = ai.chats.create({
        model,
        config: { systemInstruction },
        history: history.slice(0, -1),
      });

      const lastMessage = history[history.length - 1]?.parts[0]?.text || "Hello";
      const response = await chat.sendMessage({ message: lastMessage });

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API error");
      return res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
