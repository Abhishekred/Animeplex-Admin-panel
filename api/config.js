const REPO = process.env.GITHUB_REPOSITORY || "Abhishekred/Animeplex-Admin-panel";
const BRANCH = process.env.GITHUB_BRANCH || "main";
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") { res.setHeader("Allow", "GET, OPTIONS"); return res.status(405).end(JSON.stringify({ error: "Method not allowed" })); }
  try {
    const url = `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(BRANCH)}/admin-config.json`;
    const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) return res.status(502).end(JSON.stringify({ error: "Could not load app configuration." }));
    const config = await r.json();
    // This endpoint is public for mobile clients. Never include credentials or admin-only secrets here.
    return res.status(200).end(JSON.stringify({ app: "AnimePlex", config, updatedAt: config.updatedAt || null }));
  } catch (e) { return res.status(502).end(JSON.stringify({ error: e.message || "Configuration unavailable." })); }
};
