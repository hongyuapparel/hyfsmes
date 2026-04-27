---
name: deploy-to-prod
description: 将代码变更部署到生产环境。执行 git 提交、推送、以及宝塔上线流程。当用户说"部署""上线""发布到生产""推到宝塔"或"正式发布"时使用。
compatibility: Git, SSH（宝塔）
---

## 用途

完整的部署流程一键执行：检查改动 → 提交 → 推送 → 宝塔部署。

## 执行步骤

### 第 1 步：检查当前改动

```bash
git status
```

确认：
- 没有未 commit 的关键改动要被遗漏
- 所有改动都已测试

### 第 2 步：提交改动

```bash
git add .
git commit -m "your descriptive message"
```

**提交信息格式示例：**
- 功能: `feat: 添加订单导出功能`
- 修复: `fix: 修复库存列表筛选 bug`
- 优化: `perf: 优化订单列表加载速度`

### 第 3 步：推送到主分支

```bash
# 查看当前分支
git branch

# 切换到 main（如果不在的话）
git checkout main

# 拉取最新代码确保无冲突
git pull origin main

# 推送到远程
git push origin main
```

### 第 4 步：宝塔部署

登入宝塔终端，执行部署命令：

```bash
cd /www/wwwroot/erp.hyfsmes.com
git fetch --all --prune
git checkout main
git pull --ff-only origin main
PROJECT_ROOT=/www/wwwroot/erp.hyfsmes.com sh ./scripts/deploy-full.sh
```

**流程说明：**
1. 进入项目目录
2. 更新 git 分支信息
3. 切换到 main 分支
4. 拉取最新代码
5. 执行自动部署脚本（npm install、build 等）

**部署时间：** 通常 3-5 分钟，在宝塔终端可实时查看日志

### 第 5 步：验证部署

- 访问生产环境 URL 检查改动
- 查看宝塔部署日志确认无错误
- 检查关键页面和功能是否正常

## 常见问题

**推送被拒绝？**
- 可能远程有新改动：`git pull origin main` 后再推送
- 检查是否有权限访问该分支

**宝塔部署失败？**
- 查看宝塔面板的实时日志
- 常见原因：npm install 失败、build 失败、端口被占用
- 如需回滚：宝塔通常保留上个版本，可点击回滚按钮

## 注意事项

- ⚠️ 部署前**必须**确保本地代码已测试
- ⚠️ 不要在未 commit 的情况下合并他人代码
- ⚠️ 生产部署后立即检查关键功能（订单、库存、生产）
- 部署通常需要 2-10 分钟，请耐心等待

## 何时使用

- "这个功能改完了，部署到生产"
- "把这个 bug 修复上线"
- "把最新代码发布到宝塔"
- 任何需要从开发推送到生产的任务
