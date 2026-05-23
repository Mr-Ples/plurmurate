export interface PutObjectInput {
  key: string;
  body: ArrayBuffer | ReadableStream;
  contentType: string;
  publicBaseUrl: string;
}

export interface StoredObject {
  key: string;
  publicUrl: string | null;
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}
