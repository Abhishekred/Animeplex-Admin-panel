const ACTIVE_KEY = "animeplex:watching:active";
function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.end(JSON.stringify(data));
}
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}
async function redis(commands) {
  const c = redisConfig();
  if (!c) throw new Error("Live viewer storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.");
  const r = await fetch(c.url + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" }, body: JSON.stringify(commands) });
  if (!r.ok) throw new Error("Live viewer store request failed.");
  const data = await r.json();
  if (data.some(x => x.error)) throw new Error("Live viewer store returned an error.");
  return data.map(x => x.result);
}
module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret || req.headers.authorization !== "Bearer " + secret) return send(res, secret ? 401 : 503, { error: secret ? "Unauthorized" : "Admin password is not configured." });
    try {
      const now = Date.now(), cutoff = now - 90000;
      const ids = await redis([["ZREMRANGEBYSCORE", ACTIVE_KEY, "-inf", cutoff], ["ZRANGE", ACTIVE_KEY, "0", "-1"]]);
      const viewers = [];
      for (const id of (ids[1] || [])) {
        const values = await redis([["GET", "animeplex:watching:viewer:" + id]]);
        if (values[0]) { try { viewers.push(JSON.parse(values[0])); } catch {} }
      }
      return send(res, 200, { activeCount: viewers.length, viewers, updatedAt: new Date().toISOString(), staleAfterSeconds: 90 });
    } catch (e) { return send(res, 503, { error: e.message }); }
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "Method not allowed" }); }
  try {
    const body = req.body || {};
    const deviceId = String(body.deviceId || "").trim();
    const title = String(body.title || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(deviceId)) return send(res, 400, { error: "deviceId must be an 8-80 character anonymous ID." });
    if (!title || title.length > 200) return send(res, 400, { error: "A valid title (max 200 chars) is required." });
    const viewer = { deviceId, title, season: String(body.season || "").slice(0, 80), episode: String(body.episode || "").slice(0, 80), platform: String(body.platform || "android").slice(0, 30), startedAt: String(body.startedAt || new Date().toISOString()).slice(0, 40), lastSeenAt: new Date().toISOString() };
    await redis([["ZADD", ACTIVE_KEY, Date.now(), deviceId], ["SET", "animeplex:watching:viewer:" + deviceId, JSON.stringify(viewer), "EX", 120]]);
    return send(res, 200, { ok: true, heartbeatSeconds: 20 });
  } catch (e) { return send(res, 503, { error: e.message }); }
};
