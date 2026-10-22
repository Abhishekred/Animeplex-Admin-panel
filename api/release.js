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
      const r = await githubRequest(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`);
      if (r.status === 404) return send(res, 200, { app:"AnimePlex", version:"5.2.1", versionCode:206, forceUpdate:false, title:"AnimePlex update", releaseNotes:"", apkUrl:"", publishedAt:"", minimumVersion:"0.0.0" });
      const data = await r.json();
      if (!r.ok) return send(res, 502, { error:"Could not read release manifest from GitHub." });
      return send(res, 200, JSON.parse(Buffer.from(data.content, "base64").toString("utf8")));
    } catch (e) { return send(res, 500, { error:e.message || "Server error" }); }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error:"Method not allowed" });
  }
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return send(res, 503, { error:"Set ADMIN_PASSWORD in Vercel environment variables first." });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) return send(res, 401, { error:"Unauthorized" });

  const body = req.body || {};
  const version = String(body.version || "").trim();
  const versionCode = Number(body.versionCode);
  const apkUrl = String(body.apkUrl || "").trim();
  if (!/^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) return send(res, 400, { error:"Version must look like 5.2.2" });
  if (!Number.isInteger(versionCode) || versionCode < 1) return send(res, 400, { error:"Version code must be a positive integer." });
  if (apkUrl && !/^https:\\/\\//i.test(apkUrl)) return send(res, 400, { error:"APK URL must use HTTPS." });

  try {
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const currentResponse = await githubRequest(`${url}?ref=${encodeURIComponent(BRANCH)}`);
    let sha;
    if (currentResponse.ok) sha = (await currentResponse.json()).sha;
    else if (currentResponse.status !== 404) return send(res, 502, { error:"Could not check current manifest." });

    const manifest = {
      app:"AnimePlex", version, versionCode,
      forceUpdate: body.forceUpdate === true,
      title: String(body.title || "AnimePlex update").slice(0,100),
      releaseNotes: String(body.releaseNotes || "").slice(0,4000),
      apkUrl,
      minimumVersion: String(body.minimumVersion || "0.0.0"),
      publishedAt: new Date().toISOString(),
    };
    const payload = { message:`Publish AnimePlex ${version} release`, content:Buffer.from(JSON.stringify(manifest,null,2)+"\\n").toString("base64"), branch:BRANCH };
    if (sha) payload.sha = sha;
    const write = await githubRequest(url, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const result = await write.json();
    if (!write.ok) return send(res, 502, { error:result.message || "GitHub could not publish the release." });
    return send(res, 200, { ok:true, manifest });
  } catch (e) { return send(res, 500, { error:e.message || "Server error" }); }
};
