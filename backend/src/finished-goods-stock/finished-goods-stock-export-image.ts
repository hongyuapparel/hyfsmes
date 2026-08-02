import { existsSync } from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path';
import * as sharp from 'sharp';
import {
  createWpsCellImageId,
  type WpsCellImage,
} from './finished-goods-stock-cell-image';

type ConvertedImage = {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
};

export type PreparedFinishedStockImages = {
  imageBySourceKey: Map<string, WpsCellImage>;
  failedImages: Map<string, string>;
  cellImages: WpsCellImage[];
};

const IMAGE_PREPARE_CONCURRENCY = 6;

export type ResolvedExportImagePath = {
  originalPath: string;
  thumbnailPath: string;
};

export function getExportImageIdentity(rawUrl: string): string {
  if (!rawUrl) return '';
  if (/^data:image\//i.test(rawUrl)) return rawUrl;
  try {
    return /^https?:\/\//i.test(rawUrl)
      ? decodeURIComponent(new URL(rawUrl).pathname)
      : decodeURIComponent(rawUrl.split(/[?#]/, 1)[0]);
  } catch {
    return rawUrl;
  }
}

export function resolveExportImagePath(
  rawUrl: string,
  uploadRoot = join(process.cwd(), 'uploads'),
): ResolvedExportImagePath | null {
  try {
    const pathname = /^https?:\/\//i.test(rawUrl)
      ? new URL(rawUrl).pathname
      : rawUrl.split(/[?#]/, 1)[0];
    const match = pathname.match(/\/(?:api\/)?uploads\/(.+)$/i);
    if (!match) return null;

    const decodedPath = decodeURIComponent(match[1]).replace(/\\/g, '/');
    const segments = decodedPath.split('/').filter(Boolean);
    if (
      segments.length === 0
      || segments.some((segment) => segment === '.' || segment === '..' || segment.includes(':'))
    ) {
      return null;
    }

    const resolvedRoot = resolve(uploadRoot);
    const originalPath = resolve(resolvedRoot, ...segments);
    const pathFromRoot = relative(resolvedRoot, originalPath);
    if (!pathFromRoot || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) return null;

    return {
      originalPath,
      thumbnailPath: join(dirname(originalPath), `small_${basename(originalPath)}`),
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function convertImageToPng(rawUrl: string): Promise<ConvertedImage | null> {
  try {
    const dataMatch = rawUrl.match(/^data:image\/[\w.+-]+;base64,(.+)$/i);
    let source: Buffer | string;
    if (dataMatch) {
      source = Buffer.from(dataMatch[1], 'base64');
    } else {
      const resolvedPaths = resolveExportImagePath(rawUrl);
      if (!resolvedPaths) return null;
      const preferredThumbnail = /^small_/i.test(basename(resolvedPaths.originalPath))
        ? resolvedPaths.originalPath
        : resolvedPaths.thumbnailPath;
      source = existsSync(preferredThumbnail)
        ? preferredThumbnail
        : existsSync(resolvedPaths.originalPath)
          ? resolvedPaths.originalPath
          : '';
      if (!source) return null;
    }

    const { data, info } = await sharp(source)
      .rotate()
      .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      widthPx: info.width || 160,
      heightPx: info.height || 160,
    };
  } catch {
    return null;
  }
}

export async function prepareFinishedStockImages(
  rawUrls: string[],
): Promise<PreparedFinishedStockImages> {
  const sources = new Map<string, string>();
  rawUrls.forEach((rawUrl) => {
    const sourceKey = getExportImageIdentity(rawUrl);
    if (sourceKey && !sources.has(sourceKey)) sources.set(sourceKey, rawUrl);
  });

  const converted = await mapWithConcurrency(
    Array.from(sources.entries()),
    IMAGE_PREPARE_CONCURRENCY,
    async ([sourceKey, rawUrl]) => ({ sourceKey, rawUrl, image: await convertImageToPng(rawUrl) }),
  );
  const imageBySourceKey = new Map<string, WpsCellImage>();
  const imageByContentId = new Map<string, WpsCellImage>();
  const failedImages = new Map<string, string>();
  const cellImages: WpsCellImage[] = [];

  converted.forEach(({ sourceKey, rawUrl, image }) => {
    if (!image) {
      failedImages.set(sourceKey, rawUrl);
      return;
    }
    const imageId = createWpsCellImageId(image.buffer);
    let cellImage = imageByContentId.get(imageId);
    if (!cellImage) {
      cellImage = {
        id: imageId,
        buffer: image.buffer,
        widthPx: image.widthPx,
        heightPx: image.heightPx,
      };
      imageByContentId.set(imageId, cellImage);
      cellImages.push(cellImage);
    }
    imageBySourceKey.set(sourceKey, cellImage);
  });

  return { imageBySourceKey, failedImages, cellImages };
}
