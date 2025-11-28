#!/usr/bin/env node

import fs from "fs"
import { execSync } from "child_process"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables from .env file
dotenv.config({ path: join(projectRoot, ".env") })

// Check if we're in a development environment (not CI)
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"

// Only run token refresh in non-CI environments
if (!isCI) {
  console.log("🔄 Refreshing Strava token...")

  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      "STRAVA_CLIENT_ID",
      "STRAVA_CLIENT_SECRET",
      "STRAVA_BOOTSTRAP_REFRESH_TOKEN",
    ]

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

    if (missingVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingVars.join(", ")}`)
      console.log(
        "   Skipping token refresh. Make sure to set these in your .env file or environment.",
      )
    } else {
      // Refresh the token
      execSync("node scripts/refresh-token.js", {
        cwd: projectRoot,
        stdio: "inherit",
      })

      console.log("✅ Strava token refreshed successfully")
    }
  } catch (error) {
    console.error("❌ Error refreshing Strava token:", error.message)
    console.log("   Continuing with build...")
  }
} else {
  console.log("🏗️  Running in CI environment, skipping token refresh")
}

// Set up environment variables for the build
try {
  const tokenPath = join(projectRoot, "strava-token.json")

  if (fs.existsSync(tokenPath)) {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, "utf8"))
    const envPath = join(projectRoot, ".env")

    // Read existing .env file or create empty content
    let envContent = ""
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8")
    }

    // Remove existing STRAVA_ACCESS_TOKEN line if it exists
    const lines = envContent.split("\n")
    const filteredLines = lines.filter(
      (line) =>
        !line.startsWith("STRAVA_ACCESS_TOKEN=") &&
        !line.startsWith("STRAVA_BOOTSTRAP_REFRESH_TOKEN="),
    )

    // Add the new STRAVA_ACCESS_TOKEN
    const newEnvContent =
      filteredLines.join("\n") +
      (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] !== "" ? "\n" : "") +
      `STRAVA_ACCESS_TOKEN=${tokenData.access_token}\n` +
      `STRAVA_BOOTSTRAP_REFRESH_TOKEN=${tokenData.refresh_token}\n`

    fs.writeFileSync(envPath, newEnvContent)
    fs.unlinkSync(tokenPath)

    console.log("✅ Environment variables set up for build")
  } else {
    console.log("⚠️  No token file found, build will proceed without Strava integration")
  }
} catch (error) {
  console.error("❌ Error setting up environment variables:", error.message)
}

console.log("✅ Prebuild steps completed")
