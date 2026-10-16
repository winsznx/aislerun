import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ReadStream } from "node:fs";
import { sha256Hex } from "./tokens.js";

export interface StoredObject {
  key: string;
  bytes: number;
  sha256: string;
}

// Private evidence store on a local volume. Objects are never served directly; the API streams
// them only after checking a signed, expiring, per-inspection URL.
export class EvidenceStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(inspectionId: string, sourcePath: string): Promise<StoredObject> {
    const data = await readFile(sourcePath);
    const sha256 = sha256Hex(data);
    const key = `${inspectionId}/${sha256}${extname(sourcePath)}`;
    const dest = this.pathFor(key);
    await mkdir(join(this.root, inspectionId), { recursive: true });
    await copyFile(sourcePath, dest);
    const written = await stat(dest);
    if (written.size !== data.length) throw new Error(`evidence write incomplete for ${key}`);
    return { key, bytes: data.length, sha256 };
  }

  open(key: string): ReadStream {
    return createReadStream(this.pathFor(key));
  }

  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error("evidence key escapes the store");
    return full;
  }
}
