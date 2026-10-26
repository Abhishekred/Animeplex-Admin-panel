# AnimePlex Control Center V2

A responsive, dark admin dashboard for managing AnimePlex release metadata and centrally stored app settings. Hosted on Vercel, with GitHub-backed configuration and optional Upstash Redis telemetry.

## Features

- Responsive hamburger navigation with separate Overview, Live Viewers, App Control, Content, Providers, Playback & Language, Watch Party, Notifications, Updates & Releases, Security & Privacy, and System Settings pages.
- Authenticated settings API that stores durable configuration in `admin-config.json` in this repository.
- Release manifest publishing through `api/release.js`, preserving the public manifest contract used by compatible app builds.
- Manual OTA workflow trigger for `Abhishekred/animeplex-upgrade`.
- Live viewer heartbeat API backed by Upstash Redis. The dashboard shows real reported sessions and does not fabricate viewer counts.

## Deploy

Import this repository into Vercel and set these Environment Variables:

- `ADMIN_PASSWORD`: long, unique admin password.
- `GITHUB_TOKEN`: fine-grained token with Contents read/write permission on this admin repository.
- `GITHUB_REPOSITORY` (optional): defaults to `Abhishekred/Animeplex-Admin-panel`.
- `GITHUB_BRANCH` (optional): defaults to `main`.
- `GH_PAT` (optional, needed for OTA trigger): token with Actions write and Contents read access to `Abhishekred/animeplex-upgrade`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (needed for live viewer telemetry): create a Redis database and add its REST credentials.

Never put GitHub tokens or Redis credentials in the dashboard HTML or Android app.

## App integration required for full control

The dashboard stores settings in `admin-config.json`; the Android app must fetch and apply the approved settings in each relevant screen. Do not embed `ADMIN_PASSWORD` or GitHub tokens in the APK. Add a public read-only config endpoint that returns only approved client settings before exposing settings to the app.

For live viewing, supported app builds should POST a heartbeat to `/api/telemetry` while playback is active, approximately every 20 seconds. JSON example:

```json
{
  "deviceId": "anonymous-random-device-id",
  "title": "Example Movie",
  "season": "",
  "episode": "",
  "platform": "android",
  "startedAt": "2026-10-27T00:00:00.000Z"
}
```

The API expires stale sessions after 90 seconds. Use an anonymous random device ID; do not send names, email addresses, or other personal information. Because the heartbeat endpoint is public for app clients, add rate limiting and abuse protection before production-scale use.

## Realtime notes

The dashboard refreshes API data periodically (currently every 12 seconds). Vercel Functions are request-based/stateless, so durable shared data is stored externally. This is polling-based near-real-time monitoring, not a WebSocket push channel. A true push notification channel can be added later using a realtime provider.

## Release contract

The Android app can continue reading:

`https://raw.githubusercontent.com/Abhishekred/Animeplex-Admin-panel/main/release.json`

A release manifest can notify users and link to an HTTPS APK. It does not build APKs, create binary delta patches, or guarantee an OTA update. OTA publishing requires a compatible EAS Update configuration and app binary.
