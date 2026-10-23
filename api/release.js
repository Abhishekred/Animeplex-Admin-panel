const REPO = process.env.GITHUB_REPOSITORY || "Abhishekred/Animeplex-Admin-panel";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "release.json";

function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(data));
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Server setup incomplete: GITHUB_TOKEN is not configured.");
  return fetch(url, { ...options, headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {}),
  }});
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      // The manifest is public and is also read directly by the Android app.
      // Fetching raw content avoids requiring a token just to load the dashboard.
      const rawUrl = `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(BRANCH)}/${FILE_PATH}`;
      const r = await fetch(rawUrl, { headers: { "Cache-Control": "no-cache" } });
      if (r.status === 404) return send(res, 404, { error: "release.json was not found on the configured repository/branch." });
      if (!r.ok) return send(res, 502, { error: `GitHub raw manifest request failed (HTTP ${r.status}).` });
      const manifest = await r.json();
      if (!manifest || typeof manifest !== "object" || !manifest.version || !Number.isInteger(Number(manifest.versionCode))) {
        return send(res, 502, { error: "release.json is not a valid AnimePlex release manifest." });
      }
      return send(res, 200, manifest);
    } catch (e) {
      return send(res, 502, { error: e.message || "Could not read release manifest from GitHub." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  }
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return send(res, 503, { error: "Set ADMIN_PASSWORD in Vercel environment variables first." });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) return send(res, 401, { error: "Unauthorized" });

  const body = req.body || {};

  // Trigger the app repository's manual-only OTA workflow from the admin panel.
  if (body.action === "publishOTA") {
    const token = process.env.GH_PAT;
    if (!token) return send(res, 503, { error: "Set GH_PAT in Vercel to a GitHub token with Actions: write and Contents: read access to Abhishekred/animeplex-upgrade." });
    try {
      const dispatchUrl = "https://api.github.com/repos/Abhishekred/animeplex-upgrade/actions/workflows/ota-update.yml/dispatches";
      const dispatch = await fetch(dispatchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      });
      if (dispatch.status !== 204) {
        const details = await dispatch.text();
        return send(res, 502, { error: `GitHub could not start the OTA workflow (HTTP ${dispatch.status}). ${details.slice(0, 500)}` });
      }
      return send(res, 200, { ok: true, message: "OTA workflow started. Check Actions in the animeplex-upgrade repository for progress." });
    } catch (e) {
      return send(res, 500, { error: e.message || "Could not trigger OTA workflow." });
    }
  }
  const version = String(body.version || "").trim();
  const versionCode = Number(body.versionCode);
  const apkUrl = String(body.apkUrl || "").trim();
  const versionParts = version.split(".");
  if (versionParts.length !== 3 || versionParts.some(part => part.length === 0 || !Number.isInteger(Number(part)) || Number(part) < 0)) return send(res, 400, { error: "Version must look like 5.2.2" });
  if (!Number.isInteger(versionCode) || versionCode < 1) return send(res, 400, { error: "Version code must be a positive integer." });
  if (apkUrl && !apkUrl.toLowerCase().startsWith("https://")) return send(res, 400, { error: "APK URL must use HTTPS." });
  if (body.forceUpdate === true && !apkUrl) return send(res, 400, { error: "A forced update requires an HTTPS APK URL." });

  try {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const currentResponse = await githubRequest(`${url}?ref=${encodeURIComponent(BRANCH)}`);
    let sha;
    if (currentResponse.ok) sha = (await currentResponse.json()).sha;
    else if (currentResponse.status !== 404) return send(res, 502, { error: `Could not check current manifest (GitHub HTTP ${currentResponse.status}). Check GITHUB_TOKEN permissions and repository settings.` });

    const manifest = {
      app: "AnimePlex", version, versionCode,
      forceUpdate: body.forceUpdate === true,
      title: String(body.title || "AnimePlex update").slice(0, 100),
      releaseNotes: String(body.releaseNotes || "").slice(0, 4000),
      apkUrl,
      minimumVersion: String(body.minimumVersion || "0.0.0"),
      publishedAt: new Date().toISOString(),
    };
    const payload = { message: `Publish AnimePlex ${version} release`, content: Buffer.from(JSON.stringify(manifest, null, 2) + "\n").toString("base64"), branch: BRANCH };
    if (sha) payload.sha = sha;
    const write = await githubRequest(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await write.json();
    if (!write.ok) return send(res, 502, { error: result.message || `GitHub could not publish the release (HTTP ${write.status}).` });
    return send(res, 200, { ok: true, manifest });
  } catch (e) {
    return send(res, 500, { error: e.message || "Server error" });
  }
};
