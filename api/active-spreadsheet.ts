import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // On Vercel, spreadsheet config is stored client-side in sessionStorage
  // This endpoint returns null — client falls back to sessionStorage
  return res.json({ spreadsheetConfig: null, hasAdminToken: false });
}
