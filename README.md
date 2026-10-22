# AnimePlex Release Console

A lightweight admin dashboard and Vercel serverless API for publishing the app's release manifest. No Vercel deployment is required to create these files, but the API only runs after deployment.

## Deploy later
Import this repository into Vercel. In Project → Settings → Environment Variables, configure:

- `GITHUB_TOKEN`: fine-grained GitHub token with **Contents: Read and write** on this repository only.
- `ADMIN_PASSWORD`: a long random secret used by the dashboard.
- Optional `GITHUB_REPOSITORY`: defaults to `Abhishekred/Animeplex-Admin-panel`.
- Optional `GITHUB_BRANCH`: defaults to `main`.

Never put `GITHUB_TOKEN` in the dashboard HTML or mobile app. Rotate it if it is ever exposed.

## Connection contract
The app reads the public manifest from:

`https://raw.githubusercontent.com/Abhishekred/Animeplex-Admin-panel/main/release.json`

The API `GET /api/release` reads the same manifest. Authenticated `POST /api/release` validates and commits new release metadata to GitHub. Vercel deployment and environment variables are required for publishing from the dashboard.

## Important update limits
The manifest can notify the app about a newer version and provide an HTTPS APK URL. This alone does not create delta APK patches or OTA JavaScript updates. Native APK install remains a separate download/install flow. Expo OTA updates require a compatible EAS Update configuration and a binary built with that configuration.
