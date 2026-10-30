import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import type {
  ObjectStorageService,
  PutObjectInput,
} from './object-storage.service.js';

/**
 * Stockage audio privé sur Cloudflare R2 (API S3-compatible, SigV4).
 * Pas d’URL publique durable : putObject + getSignedGetUrl à TTL court.
 * CLOUDFLARE_R2_PUBLIC_BASE_URL n’est pas utilisé pour l’écoute des témoignages.
 */
@Injectable()
export class R2ObjectStorageService implements ObjectStorageService {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly host: string;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    this.accessKeyId = config.getOrThrow<string>('CLOUDFLARE_R2_ACCESS_KEY_ID');
    this.secretAccessKey = config.getOrThrow<string>(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    );
    this.bucket = config.getOrThrow<string>('CLOUDFLARE_R2_BUCKET_NAME');
    const endpointUrl = new URL(
      config.getOrThrow<string>('CLOUDFLARE_R2_ENDPOINT'),
    );
    this.host = endpointUrl.host;
    this.endpoint = `${endpointUrl.protocol}//${endpointUrl.host}`;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const path = `/${this.bucket}/${input.objectKey}`;
    const amzDate = this.amzDate();
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(input.body);
    const headers: Record<string, string> = {
      host: this.host,
      'content-type': input.contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const authorization = this.sign({
      method: 'PUT',
      canonicalUri: path,
      canonicalQuerystring: '',
      headers,
      payloadHash,
      amzDate,
      dateStamp,
    });

    const response = await fetch(`${this.endpoint}${path}`, {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: new Uint8Array(input.body),
    });
    if (!response.ok) {
      throw new Error(`R2 putObject failed with status ${response.status}`);
    }
  }

  async getSignedGetUrl(
    objectKey: string,
    ttlSeconds: number,
  ): Promise<string> {
    const path = `/${this.bucket}/${objectKey}`;
    const amzDate = this.amzDate();
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const credential = `${this.accessKeyId}/${credentialScope}`;
    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(ttlSeconds),
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalHeaders = `host:${this.host}\n`;
    const canonicalRequest = [
      'GET',
      path,
      query.toString(),
      canonicalHeaders,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = hmacHex(this.signingKey(dateStamp), stringToSign);
    query.set('X-Amz-Signature', signature);
    return `${this.endpoint}${path}?${query.toString()}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    const path = `/${this.bucket}/${objectKey}`;
    const amzDate = this.amzDate();
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex('');
    const headers: Record<string, string> = {
      host: this.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const authorization = this.sign({
      method: 'DELETE',
      canonicalUri: path,
      canonicalQuerystring: '',
      headers,
      payloadHash,
      amzDate,
      dateStamp,
    });

    const response = await fetch(`${this.endpoint}${path}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        Authorization: authorization,
      },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 deleteObject failed with status ${response.status}`);
    }
  }

  private sign(input: {
    method: string;
    canonicalUri: string;
    canonicalQuerystring: string;
    headers: Record<string, string>;
    payloadHash: string;
    amzDate: string;
    dateStamp: string;
  }) {
    const signedHeaderKeys = Object.keys(input.headers)
      .map((k) => k.toLowerCase())
      .sort();
    const canonicalHeaders = signedHeaderKeys
      .map((k) => `${k}:${input.headers[k].trim()}`)
      .join('\n');
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalRequest = [
      input.method,
      input.canonicalUri,
      input.canonicalQuerystring,
      `${canonicalHeaders}\n`,
      signedHeaders,
      input.payloadHash,
    ].join('\n');
    const credentialScope = `${input.dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      input.amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');
    const signature = hmacHex(this.signingKey(input.dateStamp), stringToSign);
    return `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private signingKey(dateStamp: string) {
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, 'auto');
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
  }

  private amzDate() {
    return new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}
