import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync, unlink } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import { MultipartFile } from '@fastify/multipart';
import { fromBuffer } from 'file-type';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class UploadsService {
  private readonly uploadsDir: string;

  constructor(private readonly config: ConfigService) {
    const dir = this.config.get<string>('UPLOADS_DIR', './uploads');
    this.uploadsDir = dir.startsWith('.')
      ? join(process.cwd(), dir)
      : dir;

    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveFile(file: MultipartFile): Promise<{ url: string }> {
    const ext = extname(file.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        'Allowed extensions: .jpg, .jpeg, .png, .webp',
      );
    }

    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed');
    }

    const filename = `${uuidv4()}${ext === '.jpeg' ? '.jpg' : ext}`;
    const destPath = join(this.uploadsDir, filename);

    // Stream straight to disk; @fastify/multipart enforces fileSize limit
    // (MAX_FILE_SIZE) and marks the stream as truncated if exceeded.
    await pipeline(file.file, createWriteStream(destPath));

    if ((file.file as any).truncated) {
      await this.unlinkSafe(destPath);
      throw new BadRequestException('File size exceeds 5 MB limit');
    }

    // Magic-byte verification — read the file head, ensure detected type
    // matches an allowed mime. Without this, an attacker can label any
    // payload `image/jpeg` and bypass the mimetype check above.
    const headerBuf = await this.readHead(destPath, 4100);
    const detected = await fromBuffer(headerBuf);
    if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
      await this.unlinkSafe(destPath);
      throw new BadRequestException('File content does not match image type');
    }

    return { url: `/static/${filename}` };
  }

  private async readHead(path: string, bytes: number): Promise<Buffer> {
    const { open } = await import('fs/promises');
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  private unlinkSafe(path: string): Promise<void> {
    return new Promise((resolve) => unlink(path, () => resolve()));
  }
}
