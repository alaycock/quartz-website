import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

/**
 * Content-addressed file cache: a key is derived from everything that affects the
 * file, so an existing file is always valid and renames never cause refetches.
 */
export class FileCache {
  constructor(private dir: string) {}

  async read(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.dir, key))
    } catch {
      return null
    }
  }

  async write(key: string, content: Buffer | string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(path.join(this.dir, key), content)
  }
}

export const hashKey = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)
