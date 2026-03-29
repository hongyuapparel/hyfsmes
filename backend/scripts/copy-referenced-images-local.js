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
 *   node scripts/copy-referenced-images-local.js --limit 100
 *   OLD_WEBROOT=/www/wwwroot/hyfs/WebRoot node scripts/copy-referenced-images-local.js
 *
 * 若终端里「路径不存在」但宝塔文件管理器能看到图：多为 SSH 连的不是同一台机，或目录名大小写不一致。
 * 可直接指定图片根目录（日期文件夹的上一级）：
 *   node scripts/copy-referenced-images-local.js --images-dir "/www/wwwroot/hyfs/WebRoot/Public/Images" --dry-run --limit 20
 *
 * 当库里日期目录与磁盘不一致（如库是 2020-xx，盘上只有 2022-xx）时，可用按文件名全盘索引（哈希名通常唯一）：
 *   node scripts/copy-referenced-images-local.js --images-dir "/www/wwwroot/hyfs/WebRoot/Public/images" --resolve-by-basename --dry-run --limit 50
 *
 * 只迁移「旧站磁盘上确实存在」的图片（库里有记录但盘上已删的日期路径会跳过，不报失败）：
 *   node scripts/copy-referenced-images-local.js --images-dir "/www/wwwroot/hyfs/WebRoot/Public/images" --match-disk-only --dry-run
 */
const fs = require('fs');
const os = require('os');
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
    imagesDir: process.env.OLD_IMAGES_DIR || '',
    resolveByBasename: process.env.RESOLVE_IMAGE_BY_BASENAME === '1',
    matchDiskOnly: process.env.MATCH_DISK_ONLY === '1',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--resolve-by-basename') {
      args.resolveByBasename = true;
      continue;
    }
    if (token === '--match-disk-only') {
      args.matchDiskOnly = true;
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
    if (token === '--images-dir' && argv[i + 1]) {
      args.imagesDir = argv[i + 1];
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
 * @param {string} imagesBaseDir — Public/Images 目录本身（其下为 2020-11-17 等日期文件夹）
 */
function resolveLocalSourceFile(imagesBaseDir, pathname) {
  const norm = pathname.replace(/\\/g, '/');
  const m = norm.match(/\/public\/images\/(.+)$/i);
  const rest = m ? m[1] : '';
  if (!rest) {
    const parts = norm.replace(/^\/+/, '').split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === 'images');
    if (idx >= 0 && parts[idx + 1]) {
      const tail = parts.slice(idx + 1);
      const p = path.join(imagesBaseDir, ...tail);
      if (fs.existsSync(p)) return p;
      return p;
    }
    return path.join(imagesBaseDir, 'missing');
  }
  const segs = rest.split('/').filter(Boolean);
  const direct = path.join(imagesBaseDir, ...segs);
  if (fs.existsSync(direct)) return direct;
  return direct;
}

function webRootVariants(preferred) {
  const primary = path.resolve(preferred);
  const base = path.basename(primary);
  const dir = path.dirname(primary);
  const out = [primary];
  if (base === 'WebRoot') out.push(path.join(dir, 'webroot'));
  if (base === 'webroot') out.push(path.join(dir, 'WebRoot'));
  return [...new Set(out)];
}

/** 在 WebRoot 下找 Public/Images（及大小写变体） */
function imagesDirUnderWebRoot(webRootAbs) {
  if (!fs.existsSync(webRootAbs)) return '';
  const pubs = ['Public', 'public'];
  const imgs = ['Images', 'images'];
  for (const pub of pubs) {
    for (const img of imgs) {
      const p = path.join(webRootAbs, pub, img);
      if (fs.existsSync(p)) return p;
    }
  }
  return '';
}

/**
 * 解析「日期文件夹的父目录」绝对路径。
 */
function resolveImagesBaseDir(webRootPreferred, explicitImagesDir) {
  if (explicitImagesDir) {
    const abs = path.resolve(explicitImagesDir);
    if (fs.existsSync(abs)) return abs;
    return '';
  }
  for (const wr of webRootVariants(webRootPreferred)) {
    const found = imagesDirUnderWebRoot(wr);
    if (found) return found;
  }
  const www = '/www/wwwroot';
  try {
    const names = fs.readdirSync(www);
    for (const name of names) {
      const site = path.join(www, name);
      let st;
      try {
        st = fs.statSync(site);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      for (const sub of ['WebRoot', 'webroot', 'Webroot']) {
        const wrPath = path.join(site, sub);
        const found = imagesDirUnderWebRoot(wrPath);
        if (found) return found;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * 遍历图片根目录，建立 文件名 -> 绝对路径（首个命中）。跳过 thumb 等目录以免误用缩略图。
 * 若同一文件名出现多次，保留先遍历到的路径，并统计冲突数。
 */
function buildBasenameIndex(rootDir) {
  const map = new Map();
  let collisionKeys = 0;
  const skipDirs = new Set(['thumb', '.git', 'node_modules']);
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name) || skipDirs.has(e.name.toLowerCase())) continue;
        stack.push(full);
      } else if (e.isFile()) {
        if (map.has(e.name)) {
          if (map.get(e.name) !== full) collisionKeys += 1;
        } else {
          map.set(e.name, full);
        }
      }
    }
  }
  return { map, collisionKeys };
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const uploadDir = path.resolve(backendDir, 'uploads', 'migration-old');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const imagesBaseDir = resolveImagesBaseDir(args.webRoot, args.imagesDir);
  if (!imagesBaseDir) {
    let wwwFirst = [];
    try {
      wwwFirst = fs.readdirSync('/www/wwwroot');
    } catch {
      wwwFirst = [];
    }
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: '本机找不到旧系统图片根目录（Public/Images，内含按日期的子文件夹）',
          hostname: os.hostname(),
          cwd: process.cwd(),
          triedWebRootVariants: webRootVariants(args.webRoot),
          explicitImagesDir: args.imagesDir || null,
          hint:
            '若宝塔文件管理器能看到图而 SSH 报错：请确认终端是否登录「与面板同一台」服务器；或在面板「终端」里执行本脚本。',
          fix:
            '也可把宝塔地址栏里 Public/Images 的完整路径复制下来执行：node scripts/copy-referenced-images-local.js --images-dir "完整路径" --dry-run --limit 20',
          wwwrootFirstLevel: wwwFirst.slice(0, 40),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let basenameIndex = null;
  if (args.resolveByBasename || args.matchDiskOnly) {
    console.error('[copy-referenced-images-local] building basename index under', imagesBaseDir, '...');
    basenameIndex = buildBasenameIndex(imagesBaseDir);
    console.error(
      JSON.stringify({
        indexBasenames: basenameIndex.map.size,
        basenameCollisionRows: basenameIndex.collisionKeys,
        matchDiskOnly: args.matchDiskOnly,
      }),
    );
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

      const sourceAbs = resolveLocalSourceFile(imagesBaseDir, pathname);
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
    let workList = uniqueByOriginal;
    if (args.matchDiskOnly && basenameIndex) {
      workList = uniqueByOriginal.filter((t) => basenameIndex.map.has(t.filename));
    }
    const skippedNotOnDisk =
      args.matchDiskOnly && basenameIndex ? uniqueByOriginal.length - workList.length : 0;
    let toProcess = workList;
    if (args.limit > 0) toProcess = workList.slice(0, args.limit);

    let copied = 0;
    let existed = 0;
    let missingSource = 0;
    let resolvedByBasename = 0;
    let failed = 0;
    const failures = [];

    if (!args.dryRun) await conn.beginTransaction();
    for (const t of toProcess) {
      try {
        let sourcePath = t.sourceAbs;
        if (args.matchDiskOnly && basenameIndex) {
          sourcePath = basenameIndex.map.get(t.filename);
        } else if (!fs.existsSync(sourcePath) && basenameIndex) {
          const alt = basenameIndex.map.get(t.filename);
          if (alt && fs.existsSync(alt)) {
            sourcePath = alt;
            resolvedByBasename += 1;
          }
        }
        if (!fs.existsSync(sourcePath)) {
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
          fs.copyFileSync(sourcePath, t.localPath);
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
          imagesBaseDir,
          uploadDir,
          sourceRows: sourceRows.length,
          candidateRows: targets.length,
          uniqueOriginalUrls: uniqueByOriginal.length,
          skippedNotOnDisk: args.matchDiskOnly ? skippedNotOnDisk : undefined,
          onDiskCandidates: args.matchDiskOnly ? workList.length : undefined,
          processedOriginalUrls: toProcess.length,
          copied,
          existedDestBeforeOrSkip: existed,
          missingSource,
          resolvedByBasename: basenameIndex && !args.matchDiskOnly ? resolvedByBasename : undefined,
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
