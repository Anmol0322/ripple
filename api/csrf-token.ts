import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CSRF_SECRET || "ripple-csrf-secret";
  return res.json({ token: secret });
}
