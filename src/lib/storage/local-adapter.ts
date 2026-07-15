import "server-only";
import { createHash } from "node:crypto";
import type { FileAssetMetadata, StorageAdapter } from "@/types/contracts";

export class LocalStorageAdapter implements StorageAdapter {
  async putPrivate(input: Uint8Array, metadata: Omit<FileAssetMetadata, "sha256">): Promise<FileAssetMetadata> {
    return { ...metadata, sha256: createHash("sha256").update(input).digest("hex"), visibility: "private" };
  }
}
