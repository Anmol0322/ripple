import type { VercelRequest, VercelResponse } from "@vercel/node";

const CSRF_SECRET = process.env.CSRF_SECRET || "ripple-static-csrf-secret";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers["x-csrf-token"];
  if (!token || token !== CSRF_SECRET) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const { accessToken, spreadsheetConfig } = req.body;
  if (!accessToken || !spreadsheetConfig) {
    return res.status(400).json({ error: "Missing accessToken or spreadsheetConfig" });
  }

  // On Vercel, we can't persist to disk — store in response only
  // The client stores config in sessionStorage
  return res.json({ success: true, activeConfig: spreadsheetConfig });
}
