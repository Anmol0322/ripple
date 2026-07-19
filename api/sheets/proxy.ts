import type { VercelRequest, VercelResponse } from "@vercel/node";

const CSRF_SECRET = process.env.CSRF_SECRET || "ripple-static-csrf-secret";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers["x-csrf-token"];
  if (!token || token !== CSRF_SECRET) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const { method, path: apiPath, body, query, spreadsheetId } = req.body;
  const clientToken = (req.headers.authorization || "").split(" ")[1];
  const adminToken = process.env.ADMIN_ACCESS_TOKEN || "";
  const tokenToUse =
    clientToken && !["null", "undefined", "PROXY"].includes(clientToken)
      ? clientToken
      : adminToken;

  if (!tokenToUse) {
    return res.status(401).json({ error: "No access token available." });
  }

  if (!spreadsheetId || !/^[a-zA-Z0-9_-]+$/.test(spreadsheetId)) {
    return res.status(400).json({ error: "Invalid spreadsheet ID." });
  }

  if (!apiPath || !/^[a-zA-Z0-9!:@.%+_\-]+$/.test(apiPath)) {
    return res.status(400).json({ error: "Invalid API path" });
  }

  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${apiPath}`;
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

  try {
    const googleRes = await fetch(url, options);
    if (!googleRes.ok) {
      return res.status(googleRes.status).json({ error: "Request unsuccessful" });
    }
    return res.json(await googleRes.json());
  } catch {
    return res.status(500).json({ error: "Sheets proxy error" });
  }
}
