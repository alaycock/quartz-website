import fs from "fs";
import fetch from "node-fetch";

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const tokenPath = "strava-token.json";

let tokenData = null;
try {
  tokenData = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
} catch {
  console.log("No existing token file, will bootstrap from secret.");
}

const now = Math.floor(Date.now() / 1000);

async function refreshIfNeeded() {
  if (tokenData && tokenData.expires_at > now + 60) {
    console.log("Token still valid until", new Date(tokenData.expires_at * 1000).toISOString());
    return tokenData;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: tokenData
      ? tokenData.refresh_token
      : process.env.STRAVA_BOOTSTRAP_REFRESH_TOKEN, // initial one-time bootstrap
  });

  const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh token: ${res.status} ${await res.text()}`);
  }

  const newToken = await res.json();
  fs.writeFileSync(tokenPath, JSON.stringify(newToken, null, 2));
  console.log("Refreshed token, expires at", new Date(newToken.expires_at * 1000).toISOString());
  return newToken;
}

refreshIfNeeded().catch(err => {
  console.error(err);
  process.exit(1);
});
