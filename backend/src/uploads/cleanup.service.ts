import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ORPHAN_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SMALL_PREFIX = 'small_';

interface TextColumnRef {
  tableName: string;
  columnName: string;
}

export interface OrphanImageItem {
  filename: string;
  sizeBytes: number;
  mtime: string;
  hasThumbnail: boolean;
}

export interface ScanOrphansResult {
  orphans: OrphanImageItem[];
  totalSize: number;
  totalCount: number;
  scanDurationMs: number;
}

export interface DeleteOrphansResult {
  deleted: string[];
  skipped: { filename: string; reason: string }[];
}

@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name);
  private textColumnsCache: TextColumnRef[] | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async scanOrphans(): Promise<ScanOrphansResult> {
    const started = Date.now();
    if (!existsSync(UPLOAD_DIR)) {
      return { orphans: [], totalSize: 0, totalCount: 0, scanDurationMs: Date.now() - started };
    }

    const columns = await this.getTextColumns();
    const cutoff = Date.now() - ORPHAN_AGE_MS;
    const entries = readdirSync(UPLOAD_DIR);
    const orphans: OrphanImageItem[] = [];

    for (const filename of entries) {
      if (filename.startsWith(SMALL_PREFIX)) continue;
      const filePath = join(UPLOAD_DIR, filename);
      let stat;
      try {
        stat = statSync(filePath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (stat.mtime.getTime() > cutoff) continue;

      const referenced = await this.isFileReferenced(filename, columns);
      if (referenced) continue;

      const thumbName = `${SMALL_PREFIX}${filename}`;
      orphans.push({
        filename,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        hasThumbnail: existsSync(join(UPLOAD_DIR, thumbName)),
      });
    }

    const totalSize = orphans.reduce((sum, o) => sum + o.sizeBytes, 0);
    return {
      orphans,
      totalSize,
      totalCount: orphans.length,
      scanDurationMs: Date.now() - started,
    };
  }

  async deleteOrphans(filenames: string[]): Promise<DeleteOrphansResult> {
    const columns = await this.getTextColumns();
    const deleted: string[] = [];
    const skipped: { filename: string; reason: string }[] = [];

    for (const raw of filenames) {
      const filename = raw.trim();
      try {
        this.assertSafeFilename(filename);
        const filePath = this.resolveUploadFilePath(filename);
        if (!existsSync(filePath)) {
          skipped.push({ filename, reason: '文件不存在' });
          continue;
        }
        const referenced = await this.isFileReferenced(filename, columns);
        if (referenced) {
          skipped.push({ filename, reason: '数据库仍有引用' });
          continue;
        }
        unlinkSync(filePath);
        const thumbPath = join(UPLOAD_DIR, `${SMALL_PREFIX}${filename}`);
        if (existsSync(thumbPath)) {
          unlinkSync(thumbPath);
        }
        deleted.push(filename);
        this.logger.log(`已删除孤立图片: ${filename}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : '删除失败';
        skipped.push({ filename, reason });
        this.logger.warn(`跳过删除 ${filename}: ${reason}`);
      }
    }

    return { deleted, skipped };
  }

  private async getTextColumns(): Promise<TextColumnRef[]> {
    if (this.textColumnsCache) return this.textColumnsCache;
    const rows: Array<{ TABLE_NAME: string; COLUMN_NAME: string }> = await this.dataSource.query(
      `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND DATA_TYPE IN ('varchar', 'text', 'mediumtext', 'longtext', 'json')`,
    );
    this.textColumnsCache = rows
      .filter((r) => this.isSafeIdentifier(r.TABLE_NAME) && this.isSafeIdentifier(r.COLUMN_NAME))
      .map((r) => ({ tableName: r.TABLE_NAME, columnName: r.COLUMN_NAME }));
    return this.textColumnsCache;
  }

  private async isFileReferenced(
    filename: string,
    columns: TextColumnRef[],
  ): Promise<boolean> {
    const pattern = `%${filename}%`;
    for (const { tableName, columnName } of columns) {
      const sql = `SELECT 1 AS hit FROM \`${tableName}\` WHERE \`${columnName}\` LIKE ? LIMIT 1`;
      const rows: Array<{ hit: number }> = await this.dataSource.query(sql, [pattern]);
      if (rows.length > 0) return true;
    }
    return false;
  }

  private assertSafeFilename(filename: string): void {
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('非法文件名');
    }
    if (filename.startsWith(SMALL_PREFIX)) {
      throw new BadRequestException('不能删除缩略图文件');
    }
    if (!/^[\w.\-]+$/.test(filename)) {
      throw new BadRequestException('非法文件名');
    }
  }

  private resolveUploadFilePath(filename: string): string {
    this.assertSafeFilename(filename);
    const uploadRoot = resolve(UPLOAD_DIR);
    const resolved = resolve(UPLOAD_DIR, filename);
    if (resolved !== uploadRoot && !resolved.startsWith(`${uploadRoot}\\`) && !resolved.startsWith(`${uploadRoot}/`)) {
      throw new BadRequestException('路径非法');
    }
    return resolved;
  }

  private isSafeIdentifier(name: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(name);
  }
}
