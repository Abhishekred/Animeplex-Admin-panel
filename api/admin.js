const REPO = process.env.GITHUB_REPOSITORY || "Abhishekred/Animeplex-Admin-panel";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "admin-config.json";
function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.end(JSON.stringify(data));
}
function authorized(req) {
  const secret = process.env.ADMIN_PASSWORD;
  return !!secret && req.headers.authorization === `Bearer ${secret}`;
}
async function github(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Set GITHUB_TOKEN in Vercel (Contents read/write permission).");
  return fetch(url, { ...options, headers: {
    Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {})
  }});
}
module.exports = async function handler(req, res) {
  if (!authorized(req)) return send(res, process.env.ADMIN_PASSWORD ? 401 : 503, { error: process.env.ADMIN_PASSWORD ? "Unauthorized" : "Set ADMIN_PASSWORD in Vercel first." });
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "Method not allowed" });
  }
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  try {
    if (req.method === "GET") {
      const r = await github(`${url}?ref=${encodeURIComponent(BRANCH)}`);
      if (!r.ok) return send(res, r.status === 404 ? 404 : 502, { error: "Could not load admin-config.json. Check GITHUB_TOKEN and repo permissions." });
      const file = await r.json();
      const config = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
      return send(res, 200, { config, updatedAt: config.updatedAt || null });
    }
    const body = req.body || {};
    if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) return send(res, 400, { error: "Expected a config object." });
    const currentResponse = await github(`${url}?ref=${encodeURIComponent(BRANCH)}`);
    if (!currentResponse.ok) return send(res, 502, { error: "Could not read current config before saving." });
    const current = await currentResponse.json();
    const config = { ...body.config, app: "AnimePlex", updatedAt: new Date().toISOString() };
    const payload = { message: "Update AnimePlex remote app settings", content: Buffer.from(JSON.stringify(config, null, 2) + "\n").toString("base64"), branch: BRANCH, sha: current.sha };
    const write = await github(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await write.json();
    if (!write.ok) return send(res, 502, { error: result.message || "GitHub could not save settings." });
    return send(res, 200, { ok: true, config, updatedAt: config.updatedAt, commit: result.commit && result.commit.sha });
  } catch (e) { return send(res, 500, { error: e.message || "Admin API error" }); }
};
