import crypto from "crypto"
import fs from "fs"

const key = crypto.createHash("sha256").update(process.env.STRAVA_CLIENT_SECRET).digest()

const encFile = process.argv[2]
const data = fs.readFileSync(encFile)

const iv = data.subarray(0, 16)
const tag = data.subarray(16, 32)
const ciphertext = data.subarray(32)

const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
decipher.setAuthTag(tag)

const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
process.stdout.write(decrypted)
