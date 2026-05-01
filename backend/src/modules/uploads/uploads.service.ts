import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import { MultipartFile } from '@fastify/multipart';
import { MAX_FILE_SIZE } from '../../common/constants';

const ALLOWED_MIME_PREFIX = 'image/';

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
    if (!file.mimetype.startsWith(ALLOWED_MIME_PREFIX)) {
      throw new BadRequestException('Only image files are allowed');
    }

    const ext = extname(file.filename) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const destPath = join(this.uploadsDir, filename);

    let bytesRead = 0;
    const chunks: Buffer[] = [];

    for await (const chunk of file.file) {
      bytesRead += chunk.length;
      if (bytesRead > MAX_FILE_SIZE) {
        throw new BadRequestException('File size exceeds 5 MB limit');
      }
      chunks.push(chunk);
    }

    await pipeline(
      (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
      createWriteStream(destPath),
    );

    return { url: `/static/${filename}` };
  }
}
