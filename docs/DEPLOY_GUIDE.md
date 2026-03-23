# Deploy Guide

这份文档用于说明本项目在“已经上线后，后续修改如何再次同步上线”。

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

- 项目根目录：`/www/wwwroot/erp.hyfsmes.com/hyfsmes`
- 前端目录：`/www/wwwroot/erp.hyfsmes.com/hyfsmes/frontend`
- 后端目录：`/www/wwwroot/erp.hyfsmes.com/hyfsmes/backend`
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

