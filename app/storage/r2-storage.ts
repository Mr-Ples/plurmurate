import type { ObjectStorage, PutObjectInput } from "./interfaces";

export class R2ObjectStorage implements ObjectStorage {
  constructor(private bucket: R2Bucket) {}

  async put(input: PutObjectInput) {
    await this.bucket.put(input.key, input.body, { httpMetadata: { contentType: input.contentType } });
    return { key: input.key, publicUrl: `/media/${input.key}` };
  }

  async get(key: string) {
    const object = await this.bucket.get(key);
    return object?.body ?? null;
  }

  async delete(key: string) {
    await this.bucket.delete(key);
  }
}
