import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const keyBase64 = process.env.ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY environment variable is not defined.');
    }
    try {
      this.key = Buffer.from(keyBase64, 'base64');
      if (this.key.length !== 32) {
        throw new Error(`ENCRYPTION_KEY must resolve to exactly 32 bytes. Resolved length: ${this.key.length} bytes.`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize EncryptionService: ${(error as Error).message}`);
    }
  }

  encrypt(text: string): string {
    if (!text) return '';
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${encrypted}:${authTag}`;
    } catch (error) {
      throw new InternalServerErrorException(`Encryption failed: ${(error as Error).message}`);
    }
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format. Expected iv:encrypted:authTag');
      }
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const authTag = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new InternalServerErrorException(`Decryption failed: ${(error as Error).message}`);
    }
  }
}
