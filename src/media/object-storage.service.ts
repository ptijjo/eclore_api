export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export type PutObjectInput = {
  objectKey: string;
  body: Buffer;
  contentType: string;
};

export interface ObjectStorageService {
  putObject(input: PutObjectInput): Promise<void>;
  getSignedGetUrl(objectKey: string, ttlSeconds: number): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}
