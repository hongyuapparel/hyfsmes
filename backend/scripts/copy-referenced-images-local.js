/**
 * 从本机旧系统站点根目录复制产品图到 uploads/migration-old，并更新 products.image_url。
 * 适用：数据库里仍是 http(s)://域名或 IP/Public/images/日期/文件名，但 HTTP 下载脚本报 ECONNREFUSED（如未监听 80）。
 *
 * 默认旧站磁盘根（站点根 = URL 的 / 对应目录）：环境变量 OLD_WEBROOT
 *   默认 /www/wwwroot/hyfs/WebRoot（与宝塔中 hyfsmes.com 站点一致时）
 *
 * Linux 区分大小写：旧站目录多为 Public/Images（大写 I），库里常见 /public/images/（小写）。
 * 脚本会按多种大小写组合解析源文件路径。
 *
 * 用法：
 *   cd backend
 *   node scripts/copy-referenced-images-local.js --dry-run --limit 20
 *   # 若本机没有 hyfs/WebRoot/Public/Images，请指定「日期文件夹的父目录」（即 Images 这一层）：
 *   node scripts/copy-referenced-images-local.js --images-root /实际路径/Public/Images --dry-run --limit 20
 *   OLD_IMAGES_ROOT=/path/to/Public/Images node scripts/copy-referenced-images-local.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIRROR_RELATIVE_DIR = '/api/uploads/migration-old';

function loadEnv(envPath) {
  const env = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const idx = line.indexOf('=');
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: 0,
    webRoot: process.env.OLD_WEBROOT || '/www/wwwroot/hyfs/WebRoot',
    imagesRoot: (process.env.OLD_IMAGES_ROOT || '').trim(),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--limit') {
      const val = Number(argv[i + 1] || 0);
      args.limit = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
      i += 1;
    }
    if (token === '--webroot' && argv[i + 1]) {
      args.webRoot = argv[i + 1];
      i += 1;
    }
    if (token === '--images-root' && argv[i + 1]) {
      args.imagesRoot = argv[i + 1].trim();
      i += 1;
    }
  }
  return args;
}

function toNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/** 从 image_url 得到 URL 路径部分，如 /Public/images/2020-11-17/x.jpg */
function urlPathname(raw) {
  const text = toNullableString(raw);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).pathname || '';
    } catch {
      return '';
    }
  }
  if (text.startsWith('/')) return text.split('?')[0].split('#')[0];
  return `/${text}`.split('?')[0].split('#')[0];
}

function toMirrorUrl(filename) {
  return `${MIRROR_RELATIVE_DIR}/${filename}`;
}

/**
 * 从 URL 路径解析旧站磁盘上的原图绝对路径。
 * 库内多为 /public/images/日期/文件，磁盘常为 WebRoot/Public/Images/日期/文件。
 * @param {string|null} directImagesRoot 若指定，则为「Images」目录本身（其下为 2020-11-17 等日期文件夹）
 */
function resolveLocalSourceFile(webRoot, pathname, directImagesRoot) {
  const norm = pathname.replace(/\\/g, '/');
  const m = norm.match(/\/public\/images\/(.+)$/i);
  const rest = m ? m[1] : '';
  const partsFromUrl = norm.replace(/^\/+/, '').split('/').filter(Boolean);
  const segs = rest ? rest.split('/').filter(Boolean) : [];

  const candidates = [];
  if (directImagesRoot && segs.length) {
    const base = path.resolve(directImagesRoot);
    candidates.push(path.join(base, ...segs));
  }
  if (rest) {
    candidates.push(
      path.join(webRoot, 'Public', 'Images', ...segs),
      path.join(webRoot, 'Public', 'images', ...segs),
      path.join(webRoot, 'public', 'Images', ...segs),
      path.join(webRoot, 'public', 'images', ...segs),
    );
  }
  if (partsFromUrl.length) {
    candidates.push(path.join(webRoot, ...partsFromUrl));
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return (
    candidates[0] ||
    path.join(webRoot, 'Public', 'Images', ...(rest ? rest.split('/').filter(Boolean) : []))
  );
}

/** 宝塔常见：WebRoot / webroot；其下 Public/Images 为旧系统上传目录 */
function resolveOldSiteWebRoot(preferred) {
  const primary = path.resolve(preferred);
  const base = path.basename(primary);
  const dir = path.dirname(primary);
  const variants = [primary];
  if (base === 'WebRoot') variants.push(path.join(dir, 'webroot'));
  if (base === 'webroot') variants.push(path.join(dir, 'WebRoot'));
  const uniq = [...new Set(variants)];
  for (const root of uniq) {
    if (!fs.existsSync(root)) continue;
    if (fs.existsSync(path.join(root, 'Public', 'Images'))) return root;
    if (fs.existsSync(path.join(root, 'public', 'Images'))) return root;
  }
  return primary;
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const uploadDir = path.resolve(backendDir, 'uploads', 'migration-old');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const webRoot = resolveOldSiteWebRoot(args.webRoot);
  const imagesRoot = args.imagesRoot ? path.resolve(args.imagesRoot) : '';

  if (imagesRoot) {
    if (!fs.existsSync(imagesRoot)) {
      console.error(
        JSON.stringify(
          { ok: false, error: '--images-root 目录不存在', imagesRoot },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(webRoot)) {
      console.error(JSON.stringify({ ok: false, error: `OLD_WEBROOT 不存在: ${webRoot}` }, null, 2));
      process.exit(1);
    }
    const imagesProbe = path.join(webRoot, 'Public', 'Images');
    if (!fs.existsSync(imagesProbe)) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: '未在默认路径找到旧系统图片目录（本机可能没有 hyfs/WebRoot 或路径不同）',
            webRoot,
            expected: imagesProbe,
            hint: '请在宝塔「文件」里点开旧站站点，找到下面一层层文件夹里含有「大量 YYYY-MM-DD 子目录」的那一层，一般为 Public/Images。',
            fix: '把该层完整路径传给 --images-root，例如：',
            example:
              'node scripts/copy-referenced-images-local.js --images-root /www/wwwroot/某站点/Public/Images --dry-run --limit 5',
            discover:
              '在终端尝试：find /www/wwwroot -maxdepth 10 -type d -name "thumb" 2>/dev/null | head -5   （thumb 常与 Images 同级）',
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  }

  const env = loadEnv(path.join(backendDir, '.env'));
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    const [rows] = await conn.query(
      "SELECT id, image_url AS imageUrl FROM products WHERE image_url IS NOT NULL AND image_url <> ''",
    );
    const sourceRows = Array.isArray(rows) ? rows : [];
    const targets = [];

    for (const row of sourceRows) {
      const original = toNullableString(row.imageUrl);
      if (!original) continue;
      if (original.startsWith(`${MIRROR_RELATIVE_DIR}/`) || original.startsWith('/uploads/migration-old/')) {
        continue;
      }
      const pathname = urlPathname(original);
      if (!pathname || !pathname.toLowerCase().includes('/public/images/')) continue;

      const filename = path.basename(pathname);
      if (!filename) continue;

      const sourceAbs = resolveLocalSourceFile(webRoot, pathname, imagesRoot || null);
      targets.push({
        id: Number(row.id),
        original,
        pathname,
        filename,
        mirrorUrl: toMirrorUrl(filename),
        localPath: path.join(uploadDir, filename),
        sourceAbs,
      });
    }

    const seenOriginal = new Set();
    const uniqueByOriginal = [];
    for (const t of targets) {
      if (seenOriginal.has(t.original)) continue;
      seenOriginal.add(t.original);
      uniqueByOriginal.push(t);
    }
    let toProcess = uniqueByOriginal;
    if (args.limit > 0) toProcess = uniqueByOriginal.slice(0, args.limit);

    let copied = 0;
    let existed = 0;
    let missingSource = 0;
    let failed = 0;
    const failures = [];

    if (!args.dryRun) await conn.beginTransaction();
    for (const t of toProcess) {
      try {
        if (!fs.existsSync(t.sourceAbs)) {
          missingSource += 1;
          failures.push({
            filename: t.filename,
            sourceAbs: t.sourceAbs,
            reason: 'source missing on disk',
          });
          continue;
        }
        if (fs.existsSync(t.localPath)) {
          existed += 1;
        } else if (!args.dryRun) {
          fs.copyFileSync(t.sourceAbs, t.localPath);
          copied += 1;
        }

        if (!args.dryRun) {
          await conn.execute('UPDATE products SET image_url = ? WHERE image_url = ?', [t.mirrorUrl, t.original]);
        }
      } catch (err) {
        failed += 1;
        failures.push({
          filename: t.filename,
          reason: (err && err.message) || String(err),
        });
      }
    }
    if (!args.dryRun) await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          webRoot,
          imagesRoot: imagesRoot || null,
          uploadDir,
          sourceRows: sourceRows.length,
          candidateRows: targets.length,
          uniqueOriginalUrls: uniqueByOriginal.length,
          processedOriginalUrls: toProcess.length,
          copied,
          existedDestBeforeOrSkip: existed,
          missingSource,
          failed,
          failures: failures.slice(0, 30),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
