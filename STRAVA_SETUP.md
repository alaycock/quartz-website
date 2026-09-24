# Strava Token Setup

This project uses the Strava API to get GPX routes for trips on Strava. You can create a Strava app here: https://www.strava.com/settings/api

This project includes automatic Strava token refresh functionality that runs before each build.

## Getting Started

To automatically refresh the Strava token, you need to generate a refresh token with the appropriate scope.

1. Go to https://www.strava.com/settings/api
2. Create a new app, if you haven't already.
3. Copy the Client ID and Client Secret and visit the following URL to authorize the app.

https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=activity:read_all

4. Once you've authorized the app, you'll be redirected to the following URL. Copy out the code from the URL.

http://localhost/exchange_token?state=&code=${CODE}&scope=read,activity:read_all

5. Exchange the code for a refresh token by making a POST request to the following URL: https://www.strava.com/oauth/token

With the following body encoded as form data:

```
client_id: ${STRAVA_CLIENT_ID}
client_secret: ${STRAVA_CLIENT_SECRET}
code: ${CODE}
grant_type: "authorization_code"
```

6. The response will be a JSON object with the refresh token. Copy out the refresh token and add it to .env as STRAVA_BOOTSTRAP_REFRESH_TOKEN.

## How It Works

1. **Prebuild Hook**: The `prebuild` script automatically runs before `npm run build`
2. **Token Refresh**: Checks if your Strava token needs refreshing (expires within 60 seconds)
3. **Environment Setup**: Sets up `STRAVA_ACCESS_TOKEN` in your `.env` file for the build

## Build Process

When you run `npm run quartz`, the following happens automatically:

1. ✅ Refresh Strava token if needed
2. ✅ Set up environment variables
3. ✅ Run Quartz build
