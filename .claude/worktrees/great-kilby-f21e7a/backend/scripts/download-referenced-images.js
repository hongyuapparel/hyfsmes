const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const mysql = require('mysql2/promise');

const DEFAULT_OLD_ASSET_BASE_URL = process.env.OLD_ASSET_BASE_URL || 'http://47.112.218.75';
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
  const args = { dryRun: false, limit: 0, insecure: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--insecure') {
      args.insecure = true;
      continue;
    }
    if (token === '--limit') {
      const val = Number(argv[i + 1] || 0);
      args.limit = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
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

function toAbsoluteUrl(raw) {
  const text = toNullableString(raw);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return `${DEFAULT_OLD_ASSET_BASE_URL}${text}`;
  return `${DEFAULT_OLD_ASSET_BASE_URL}/${text}`;
}

function toMirrorUrl(filename) {
  return `${MIRROR_RELATIVE_DIR}/${filename}`;
}

function downloadFile(urlString, destPath, insecure) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlString);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.get(
      urlString,
      urlObj.protocol === 'https:' && insecure ? { rejectUnauthorized: false } : undefined,
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, urlString).toString();
          downloadFile(nextUrl, destPath, insecure).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close(() => resolve(undefined));
        });
        ws.on('error', (err) => reject(err));
      },
    );
    req.on('error', (err) => reject(err));
    req.setTimeout(20000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const uploadDir = path.resolve(backendDir, 'uploads', 'migration-old');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
      const absolute = toAbsoluteUrl(original);
      if (!absolute) continue;
      const filename = path.basename(new URL(absolute).pathname || '');
      if (!filename) continue;
      targets.push({
        id: Number(row.id),
        original,
        absolute,
        filename,
        mirrorUrl: toMirrorUrl(filename),
        localPath: path.join(uploadDir, filename),
      });
    }

    const uniqueByFile = new Map();
    for (const t of targets) {
      if (!uniqueByFile.has(t.filename)) uniqueByFile.set(t.filename, t);
    }
    const uniqueTargets = Array.from(uniqueByFile.values());
    const finalTargets = args.limit > 0 ? uniqueTargets.slice(0, args.limit) : uniqueTargets;

    let downloaded = 0;
    let existed = 0;
    let failed = 0;
    const failures = [];

    if (!args.dryRun) await conn.beginTransaction();
    for (const t of finalTargets) {
      try {
        if (fs.existsSync(t.localPath)) {
          existed += 1;
        } else if (!args.dryRun) {
          await downloadFile(t.absolute, t.localPath, args.insecure);
          downloaded += 1;
        }

        if (!args.dryRun) {
          await conn.execute('UPDATE products SET image_url = ? WHERE image_url = ? OR image_url = ?', [
            t.mirrorUrl,
            t.original,
            t.absolute,
          ]);
        }
      } catch (err) {
        failed += 1;
        failures.push({
          filename: t.filename,
          url: t.absolute,
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
          insecure: args.insecure,
          sourceRows: sourceRows.length,
          candidateRows: targets.length,
          uniqueFiles: uniqueTargets.length,
          processedFiles: finalTargets.length,
          downloaded,
          existed,
          failed,
          failures: failures.slice(0, 20),
          uploadDir,
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
