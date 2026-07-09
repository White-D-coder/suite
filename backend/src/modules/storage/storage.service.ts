import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private isS3 = false;
  private bucketName = '';

  constructor() {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    if (provider.toLowerCase() === 's3') {
      const region = process.env.AWS_REGION || 'us-east-1';
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      this.bucketName = process.env.AWS_S3_BUCKET || '';

      if (accessKeyId && secretAccessKey) {
        this.s3Client = new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
        this.isS3 = true;
        this.logger.log('Storage initialized in S3 mode.');
      } else {
        this.logger.warn('AWS S3 credentials missing. Falling back to local storage.');
      }
    } else {
      this.logger.log('Storage initialized in Local mode.');
    }

    // Ensure local upload folder exists
    const uploadPath = path.resolve(process.cwd(), 'uploads/invoices');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
  }

  async saveFile(fileName: string, fileBuffer: Buffer): Promise<string> {
    if (this.isS3 && this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `invoices/${fileName}`,
          Body: fileBuffer,
          ContentType: 'application/pdf',
        });
        await this.s3Client.send(command);
        return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/invoices/${fileName}`;
      } catch (error) {
        this.logger.error(`S3 upload failed: ${(error as Error).message}. Falling back to local storage.`);
      }
    }

    // Local file write fallback/default
    const localDir = path.resolve(process.cwd(), 'uploads/invoices');
    const localPath = path.join(localDir, fileName);
    await fs.promises.writeFile(localPath, fileBuffer);

    // Return URL relative to backend port
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${backendUrl}/uploads/invoices/${fileName}`;
  }
}
