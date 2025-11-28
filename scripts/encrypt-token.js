import crypto from "crypto"
import fs from "fs"

const key = crypto.createHash("sha256").update(process.env.STRAVA_CLIENT_SECRET).digest()

const iv = crypto.randomBytes(16)
const tokenFile = process.argv[2]
const data = fs.readFileSync(tokenFile)

const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
const tag = cipher.getAuthTag()

// format: iv + tag + ciphertext
const output = Buffer.concat([iv, tag, encrypted])
fs.writeFileSync(tokenFile + ".enc", output)
