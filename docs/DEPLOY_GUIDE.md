# Deploy Guide

这份文档用于说明本项目在“已经上线后，后续修改如何再次同步上线”。

部署相关命令必须以本文件为准，不要凭记忆写路径。

固定服务器路径只保留一个根目录：

- 宝塔项目根目录 / Git 仓库 / 部署脚本目录 / 前端发布目录：`/www/wwwroot/erp.hyfsmes.com`
- 前端源码目录：`/www/wwwroot/erp.hyfsmes.com/frontend`
- 后端源码目录：`/www/wwwroot/erp.hyfsmes.com/backend`
- PM2 后端服务名：`erp-backend`

执行 `sh scripts/deploy-frontend.sh`、`sh scripts/deploy-backend.sh`、`sh scripts/deploy-full.sh` 前，统一先进入：

```bash
cd /www/wwwroot/erp.hyfsmes.com
```

适用目标：

- 你不需要自己判断到底改了前端、后端还是数据库
- 先让 Codex 或 Cursor 帮你检查改动范围
- 再根据结果执行对应部署脚本

## 1. 你以后最省心的说法

你以后可以直接对 Codex 说：

“遵守 CODEX RULES，帮我检查从上次上线到现在的改动，并告诉我该执行哪个部署脚本；如果有必须手动执行的步骤，请列出来。”

如果你也在用 Cursor，也可以把同样的意思发给它。

## 2. 我会怎么判断这次改动属于哪一类

本项目默认分为 4 种部署类型：

1. `frontend`
   只改了前端页面、样式、前端接口调用、图标、文案、Vite 前端资源。

2. `backend`
   改了 NestJS 接口、服务、控制器、权限、上传逻辑、后端业务代码。

3. `full`
   前端和后端都改了。

4. `db`
   涉及数据库结构、实体字段、SQL 脚本、迁移或需要变更表结构。

说明：

- `db` 通常不是单独存在，而是附加在 `backend` 或 `full` 上。
- 例如：如果改了前端和实体字段，结果通常是 `full + db`。

## 3. 我怎么帮你自动判断

仓库里新增了本地辅助脚本：

- [deploy-plan.ps1](/e:/1.Cursor-Project/6.%20hyfsmes/scripts/deploy-plan.ps1)

你或我都可以在项目根目录执行：

```powershell
.\scripts\deploy-plan.ps1
```

它会根据当前 Git 改动自动判断：

- 改动了哪些文件
- 是否涉及前端
- 是否涉及后端
- 是否涉及数据库结构
- 推荐执行哪个部署脚本

如果你想对比某个提交之后的变化，也可以执行：

```powershell
.\scripts\deploy-plan.ps1 -BaseRef <git提交号或分支名>
```

例如：

```powershell
.\scripts\deploy-plan.ps1 -BaseRef HEAD~1
```

## 4. 三种部署脚本

我给你准备了 3 个 Linux 服务器脚本模板，默认基于你截图里的目录和 PM2 名称：

- [deploy-frontend.sh](/e:/1.Cursor-Project/6.%20hyfsmes/scripts/deploy-frontend.sh)
- [deploy-backend.sh](/e:/1.Cursor-Project/6.%20hyfsmes/scripts/deploy-backend.sh)
- [deploy-full.sh](/e:/1.Cursor-Project/6.%20hyfsmes/scripts/deploy-full.sh)

默认使用的服务器目录：

- 项目根目录：`/www/wwwroot/erp.hyfsmes.com`
- 前端目录：`/www/wwwroot/erp.hyfsmes.com/frontend`
- 后端目录：`/www/wwwroot/erp.hyfsmes.com/backend`
- 前端发布目录：`/www/wwwroot/erp.hyfsmes.com`
- PM2 服务名：`erp-backend`

如果你服务器实际路径不同，只需要改这几个脚本头部变量。

## 5. 什么时候执行哪个脚本

### 只改前端

执行：

```bash
sh scripts/deploy-frontend.sh
```

适用示例：

- 页面样式
- 表单布局
- 图标 / logo / favicon
- 前端按钮交互
- 前端调用接口参数

### 改了后端，但没动数据库结构

执行：

```bash
sh scripts/deploy-backend.sh
```

适用示例：

- 新增接口逻辑
- 修改 controller / service
- 权限判断
- 文件上传逻辑

### 前后端都改了，但没动数据库结构

执行：

```bash
sh scripts/deploy-full.sh
```

### 改了数据库结构

不要直接只跑脚本就结束，必须额外处理数据库。

标准顺序：

1. 确认这次数据库改动具体是什么
2. 执行对应 SQL 或迁移
3. 再执行 `deploy-backend.sh` 或 `deploy-full.sh`
4. 最后检查后端日志和接口状态

## 6. 数据库改动时你该怎么做

当前项目并没有完整启用统一 migration 流程，仓库中已经存在“按需手动执行 SQL”的模式。

因此如果改了这些内容，要高度怀疑涉及数据库结构：

- `backend/src/entities/*`
- `backend/scripts/*.sql`
- `backend/src/database/*`
- 新增列、改字段类型、改表关系

这类情况建议你先让我检查一遍，然后我会直接告诉你：

- 这次是否真的要改数据库
- 要执行哪一个 SQL
- 先执行哪一步，后执行哪一步

## 7. 如果我能自动执行到哪一步

在你本地仓库里，我可以：

- 检查当前改动范围
- 判断推荐部署方式
- 帮你整理部署顺序
- 帮你生成或修改部署脚本

如果需要登录你的线上服务器执行命令，我通常做不到直接远程操作，除非你的环境额外给了我可用权限。

因此最常见的协作方式是：

1. 你让我先判断部署类型
2. 我给你明确列出该执行哪个脚本
3. 如果涉及必须手动做的数据库步骤，我会写成逐步清单给你
4. 你在服务器执行后，把报错贴给我，我继续帮你排查

## 8. Cursor 能不能也执行这些脚本

可以。

这些脚本不是“只给 Codex 用”的，它们本质上就是普通脚本文件：

- Codex 可以读、改、执行本地可执行部分
- Cursor 也可以读、改、参考它们
- 你自己也可以按文档手动执行

也就是说，这套部署方案是“项目资产”，不是某个 AI 专属格式。

## 9. 推荐工作流

以后你每次改完代码准备上线，推荐这样做：

1. 先对我说：
   “遵守 CODEX RULES，检查当前改动并告诉我怎么上线。”
2. 我先运行：
   `.\scripts\deploy-plan.ps1`
3. 我告诉你：
   - 推荐脚本
   - 是否涉及数据库
   - 你要不要手动执行额外步骤
4. 你再去服务器运行对应部署脚本
5. 如果部署报错，把错误贴给我继续处理

## 10. 当前项目的一条重要提醒

你现在仓库里已经存在前端和后端的未提交改动，而且后端里还有实体文件变更。

这意味着：

- 不能只凭感觉判断“是不是只改了页面”
- 上线前最好先跑一次 `.\scripts\deploy-plan.ps1`
- 如果脚本提示 `db = YES`，先不要直接部署，先让我检查数据库部分

## 11. 上线安全检查清单（重要！）

这一节是踩过坑后补的。**部署到新服务器、换域名、第一次上线时，每一条都要核对**。

### 11.1 nginx 站点配置（必须做，否则源代码会被外人下载）

宝塔面板 → 网站 → erp.hyfsmes.com → 配置文件 → 在 `server { ... }` 块里加入下面这段：

```nginx
# 禁止访问源代码、配置、git 目录等敏感路径
location ~ /\.git { deny all; return 404; }
location ~ /\.env { deny all; return 404; }
location ~ /\.cursor { deny all; return 404; }
location ~ /\.claude { deny all; return 404; }
location ~ ^/backend(/|$) { deny all; return 404; }
location ~ ^/scripts(/|$) { deny all; return 404; }
location ~ ^/docs(/|$) { deny all; return 404; }
location ~ ^/node_modules(/|$) { deny all; return 404; }
location ~ \.(env|sql|sh|ps1|log|md|tsv|bak|dump)$ { deny all; return 404; }
```

保存后，在宝塔终端执行 `nginx -t && nginx -s reload`。

**验证（必做一次）**：在浏览器或手机流量打开下面这些 URL，**都必须显示 404**：

- `https://erp.hyfsmes.com/.git/config`
- `https://erp.hyfsmes.com/backend/.env`
- `https://erp.hyfsmes.com/scripts/deploy-frontend.sh`
- `https://erp.hyfsmes.com/docs/DEPLOY_GUIDE.md`

如果任何一个能下载，说明 nginx 没生效，立即把上面配置加回去。

### 11.2 强制 HTTPS（防止首次访问时密码明文传输）

宝塔面板 → 网站 → SSL → **开启"强制 HTTPS"开关**（HTTP 自动跳 HTTPS）。

### 11.3 默认管理员密码（admin/admin123 必须改）

第一次上线后，立即登录系统：用户管理 → admin → 重置密码。**不要再用 admin123**。
密码可以简单到你能记住即可（比如公司缩写 + 年份 + 一个标识），但不能是这些公开列表里的：
`admin / admin123 / 123456 / password / 12345678 / hyfsmes / boss`。

### 11.4 环境变量（生产环境必须设的）

`backend/.env`（线上文件）里必须有这几项,**绝对不能用 `.env.example` 的默认值**：

```
NODE_ENV=production
JWT_SECRET=<这里粘贴一段随机的至少 32 位字符串，比如 openssl rand -base64 48>
MYSQL_PASSWORD=<阿里云 RDS 的真实密码>
ADMIN_PASSWORD=<不能是 admin123>
```

`JWT_SECRET` 用宝塔终端跑 `openssl rand -base64 48` 生成，复制粘贴即可。**这串字符串泄露 = 任何人能伪造任何用户登录**。

### 11.5 阿里云 RDS 数据库白名单

阿里云控制台 → RDS 实例 → 数据安全性 → 白名单设置：

- ✅ 只放服务器自己的内网 IP 或公网 IP
- ❌ 绝对不要写 `0.0.0.0/0`（任何 IP 都能连）

### 11.6 后端端口（3000）只能内网访问

宝塔面板 → 安全 → 防火墙：3000 端口**只放本机**（127.0.0.1），不对外开放。
公网只需要 80（HTTP）和 443（HTTPS），其他端口都关。
阿里云安全组同样规则。

### 11.7 PM2 启动参数

宝塔终端检查：`pm2 env erp-backend | grep NODE_ENV`，必须输出 `NODE_ENV: production`。
如果不是，停止服务后用 `NODE_ENV=production pm2 start dist/main.js --name erp-backend` 重启。

### 11.8 部署完一次性自检

部署完成后跑一次：

```bash
# 1. 确认敏感文件不可访问
curl -I https://erp.hyfsmes.com/.git/config         # 期望 404
curl -I https://erp.hyfsmes.com/backend/.env        # 期望 404

# 2. 确认 HTTP 跳转到 HTTPS
curl -I http://erp.hyfsmes.com                       # 期望 301/302 Location: https://...

# 3. 确认登录限速生效（连续错 5 次同一账号，第 6 次应该被锁 15 分钟）
# 在登录页用错的密码试 5 次，第 6 次正确密码也应该被锁住
```

任何一条不符合预期，**先不要把系统给员工使用**，先把上面对应小节再走一遍。
