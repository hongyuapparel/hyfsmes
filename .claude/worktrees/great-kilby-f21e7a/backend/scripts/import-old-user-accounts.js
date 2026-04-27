const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

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
    defaultPassword: process.env.MIGRATION_DEFAULT_PASSWORD || '123456',
    sourceDatabase: process.env.OLD_MYSQL_DATABASE || '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--limit') {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
      i += 1;
      continue;
    }
    if (token === '--default-password') {
      args.defaultPassword = String(argv[i + 1] || '').trim() || args.defaultPassword;
      i += 1;
      continue;
    }
    if (token === '--source-database') {
      args.sourceDatabase = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }
  return args;
}

function toText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeText(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[()（）【】\[\]\-_/\\,，、\s]/g, '')
    .replace(/人员|岗位|身份|角色/g, '');
}

function splitIdentityTokens(identityText) {
  return toText(identityText)
    .split(/[|,，、;/；\s]+/g)
    .map((x) => toText(x))
    .filter(Boolean);
}

const IDENTITY_ALIASES = {
  跟单员: ['跟单', 'merchandiser'],
  跟单: ['跟单员', 'merchandiser'],
  业务员: ['销售', '业务', 'sales', 'salesperson'],
  销售: ['业务员', '业务', 'sales'],
  人事: ['hr', '行政', '人事行政'],
  行政: ['hr', '人事', '人事行政'],
  财务: ['会计', 'finance'],
  管理员: ['admin', '超级管理员'],
  超级管理员: ['admin', '管理员'],
  主管: ['经理', '组长'],
};

function buildCandidateTokens(rawTokens) {
  const seen = new Set();
  const list = [];
  for (const token of rawTokens) {
    const text = toText(token);
    if (!text) continue;
    const key = normalizeText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(text);
    const aliases = IDENTITY_ALIASES[text] || [];
    for (const alias of aliases) {
      const aliasKey = normalizeText(alias);
      if (!aliasKey || seen.has(aliasKey)) continue;
      seen.add(aliasKey);
      list.push(alias);
    }
  }
  return list;
}

function scoreRoleMatch(identityToken, role) {
  const tokenNorm = normalizeText(identityToken);
  const roleNameNorm = normalizeText(role.name);
  const roleCodeNorm = normalizeText(role.code);
  if (!tokenNorm) return 0;
  if (tokenNorm === roleNameNorm || tokenNorm === roleCodeNorm) return 100;
  if (roleNameNorm.includes(tokenNorm) || tokenNorm.includes(roleNameNorm)) return 80;
  if (roleCodeNorm.includes(tokenNorm) || tokenNorm.includes(roleCodeNorm)) return 70;

  let keywordHit = 0;
  for (const kw of [tokenNorm, roleNameNorm, roleCodeNorm]) {
    if (!kw) continue;
    if (tokenNorm.includes(kw) || roleNameNorm.includes(kw) || roleCodeNorm.includes(kw)) keywordHit += 1;
  }
  if (keywordHit >= 2) return 55;
  return 0;
}

function pickRoleMatch(identityTokens, roles) {
  let best = null;
  for (const token of identityTokens) {
    for (const role of roles) {
      const score = scoreRoleMatch(token, role);
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = { roleId: role.id, roleName: role.name, score, token };
      }
    }
  }
  return best;
}

function mapUserStatus(userStatus, loginStatus) {
  const u = Number(userStatus);
  const l = Number(loginStatus);
  if (u === -1 || u === 0) return 'disabled';
  if (l === 0) return 'disabled';
  return 'active';
}

async function tableExists(conn, tableName) {
  const [dbRows] = await conn.execute('SELECT DATABASE() AS db');
  const currentDb = toText(dbRows[0]?.db);
  const [rows] = await conn.execute(
    `SELECT COUNT(1) AS c
     FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name = ?`,
    [currentDb, tableName],
  );
  return Number(rows[0]?.c || 0) > 0;
}

function assertSafeIdentifier(value, label) {
  const text = toText(value);
  if (!text) return '';
  if (!/^[A-Za-z0-9_]+$/.test(text)) {
    throw new Error(`${label} 非法：仅允许字母/数字/下划线`);
  }
  return text;
}

async function tableExistsInSchema(conn, schemaName, tableName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(1) AS c
     FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name = ?`,
    [schemaName, tableName],
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
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
    const [dbRows] = await conn.execute('SELECT DATABASE() AS db');
    const targetDb = assertSafeIdentifier(toText(dbRows[0]?.db), '目标数据库名');
    const sourceDb = assertSafeIdentifier(args.sourceDatabase || targetDb, '来源数据库名');

    const hasUser = await tableExistsInSchema(conn, sourceDb, 'erp_user');
    const hasUserLogin = await tableExistsInSchema(conn, sourceDb, 'erp_user_login');
    if (!hasUser) {
      throw new Error(`来源库 ${sourceDb} 缺少旧系统来源表：erp_user`);
    }

    const hasAuthAccess = await tableExistsInSchema(conn, sourceDb, 'erp_auth_group_access');
    const hasAuthGroup = await tableExistsInSchema(conn, sourceDb, 'erp_auth_group');
    const canJoinAuth = hasAuthAccess && hasAuthGroup;

    const [roleRows] = await conn.execute(
      `SELECT id, code, name
       FROM roles
       WHERE status = 'active'
       ORDER BY id ASC`,
    );
    const roles = roleRows.map((r) => ({
      id: Number(r.id),
      code: toText(r.code),
      name: toText(r.name),
    }));

    if (!roles.length) {
      throw new Error('新系统 roles 表为空，无法执行身份映射');
    }

    const [roleIdColRows] = await conn.execute(
      `SELECT IS_NULLABLE
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name = 'role_id'
       LIMIT 1`,
    );
    const usersRoleIdNullable = toText(roleIdColRows[0]?.IS_NULLABLE).toUpperCase() === 'YES';

    const sourceDbQuoted = `\`${sourceDb}\``;
    let baseSql = '';
    if (hasUserLogin && canJoinAuth) {
      baseSql = `
        SELECT
          u.user_id,
          u.user_name,
          u.mobile,
          u.user_number,
          u.work_type,
          u.status AS user_status,
          u.operator_flag,
          ul.account,
          ul.login_status,
          GROUP_CONCAT(DISTINCT ag.title ORDER BY ag.id SEPARATOR ',') AS group_titles
        FROM ${sourceDbQuoted}.erp_user u
        LEFT JOIN ${sourceDbQuoted}.erp_user_login ul
          ON ul.user_id = u.user_id
         AND ul.login_type = 1
        LEFT JOIN ${sourceDbQuoted}.erp_auth_group_access aga
          ON aga.uid = u.user_id
        LEFT JOIN ${sourceDbQuoted}.erp_auth_group ag
          ON ag.id = aga.group_id
         AND ag.status = 1
        WHERE u.status <> -1
          AND u.operator_flag = 1
        GROUP BY
          u.user_id, u.user_name, u.mobile, u.user_number, u.work_type, u.status, u.operator_flag,
          ul.account, ul.login_status
        ORDER BY u.user_id ASC
      `;
    } else if (hasUserLogin && !canJoinAuth) {
      baseSql = `
        SELECT
          u.user_id,
          u.user_name,
          u.mobile,
          u.user_number,
          u.work_type,
          u.status AS user_status,
          u.operator_flag,
          ul.account,
          ul.login_status,
          '' AS group_titles
        FROM ${sourceDbQuoted}.erp_user u
        LEFT JOIN ${sourceDbQuoted}.erp_user_login ul
          ON ul.user_id = u.user_id
         AND ul.login_type = 1
        WHERE u.status <> -1
          AND u.operator_flag = 1
        ORDER BY u.user_id ASC
      `;
    } else {
      baseSql = `
        SELECT
          u.user_id,
          u.user_name,
          u.mobile,
          u.user_number,
          u.work_type,
          u.status AS user_status,
          u.operator_flag,
          '' AS account,
          1 AS login_status,
          '' AS group_titles
        FROM ${sourceDbQuoted}.erp_user u
        WHERE u.status <> -1
          AND u.operator_flag = 1
        ORDER BY u.user_id ASC
      `;
    }

    const [sourceRows] = await conn.execute(baseSql);
    const slicedRows = args.limit > 0 ? sourceRows.slice(0, args.limit) : sourceRows;
    const defaultPwdHash = await bcrypt.hash(args.defaultPassword, 10);

    let inserted = 0;
    let updated = 0;
    let skippedNoAccount = 0;
    let skippedRoleRequired = 0;
    let matchedRoleCount = 0;
    let unmatchedRoleCount = 0;

    const unmatchedPreview = [];
    const skippedPreview = [];

    if (!args.dryRun) {
      await conn.beginTransaction();
    }

    for (const row of slicedRows) {
      const username = toText(row.account) || toText(row.mobile) || toText(row.user_number);
      if (!username) {
        skippedNoAccount += 1;
        if (skippedPreview.length < 20) {
          skippedPreview.push({
            userId: Number(row.user_id),
            reason: '缺少账号(account/mobile/user_number均为空)',
          });
        }
        continue;
      }

      const displayName = toText(row.user_name) || username;
      const status = mapUserStatus(row.user_status, row.login_status);
      const rawTokens = splitIdentityTokens(`${toText(row.group_titles)},${toText(row.work_type)}`);
      const candidateTokens = buildCandidateTokens(rawTokens);
      const matched = pickRoleMatch(candidateTokens, roles);
      const roleId = matched ? Number(matched.roleId) : null;

      if (matched) matchedRoleCount += 1;
      else unmatchedRoleCount += 1;

      if (!matched && unmatchedPreview.length < 30) {
        unmatchedPreview.push({
          userId: Number(row.user_id),
          username,
          displayName,
          oldIdentity: rawTokens.join(','),
        });
      }

      const [existingRows] = await conn.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
      const existing = existingRows[0];

      if (!args.dryRun) {
        if (existing) {
          if (roleId == null && !usersRoleIdNullable) {
            await conn.execute(
              `UPDATE users
               SET display_name = ?, status = ?, updated_at = NOW()
               WHERE id = ?`,
              [displayName, status, Number(existing.id)],
            );
          } else {
            await conn.execute(
              `UPDATE users
               SET display_name = ?, role_id = ?, status = ?, updated_at = NOW()
               WHERE id = ?`,
              [displayName, roleId, status, Number(existing.id)],
            );
          }
          updated += 1;
        } else {
          if (roleId == null && !usersRoleIdNullable) {
            skippedRoleRequired += 1;
            if (skippedPreview.length < 20) {
              skippedPreview.push({
                userId: Number(row.user_id),
                username,
                reason: '未匹配到角色且 users.role_id 不允许为空',
              });
            }
            continue;
          }
          await conn.execute(
            `INSERT INTO users
              (username, password_hash, display_name, role_id, status, created_at, updated_at)
             VALUES
              (?, ?, ?, ?, ?, NOW(), NOW())`,
            [username, defaultPwdHash, displayName, roleId, status],
          );
          inserted += 1;
        }
      }
    }

    if (!args.dryRun) {
      await conn.commit();
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          sourceRows: sourceRows.length,
          processedRows: slicedRows.length,
          inserted,
          updated,
          matchedRoleCount,
          unmatchedRoleCount,
          skippedNoAccount,
          skippedRoleRequired,
          usersRoleIdNullable,
          hasUserLogin,
          hasAuthGroup: canJoinAuth,
          sourceDatabase: sourceDb,
          targetDatabase: targetDb,
          rolesAvailable: roles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
          unmatchedPreview,
          skippedPreview,
          note: '账号->username，姓名->display_name，身份->role（精确+模糊）；未匹配角色时优先置空，若库约束不允许则跳过新增并记录。',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore rollback secondary error
    }
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
