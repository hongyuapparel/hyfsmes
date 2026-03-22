# 鸿宇服饰 ERP 管理系统

## 环境要求

- Node.js 18+
- MySQL 8+

## 快速启动（规定仅用脚本）

**请统一使用项目根目录下的 PowerShell 脚本启动，避免端口、环境不一致。**

1. 首次使用：复制 `backend\.env.example` 为 `backend\.env`，按需修改数据库与 JWT 等配置。
2. 安装依赖（若未安装）：
   ```powershell
   cd backend; npm install; cd ..
   cd frontend; npm install; cd ..
   ```
3. **启动**（在项目根目录执行）：
   ```powershell
   .\scripts\start.ps1
   ```
4. **检查状态**：
   ```powershell
   .\scripts\check.ps1
   ```
   应显示：db / 后端 / 前端 全部正常。
5. **停止**：
   ```powershell
   .\scripts\stop.ps1
   ```

若 `check.ps1` 报错，可根据提示排查：缺 `backend\.env`、端口被占用等，脚本会给出原因。

### 开发时如何避免反复重启

- **日常改代码不用重启**：后端用 `start:dev` 会监听文件自动重启，前端用 `dev` 会热更新，**保存文件即可生效**。
- **只有这些情况需要重启**：改了 `backend\.env`、新装了 npm 包、或服务卡死/报错需要重来。
- **需要重启时请用**：
  ```powershell
  .\scripts\restart.ps1
  ```
  会先执行 `stop.ps1` 再等几秒后执行 `start.ps1`，避免端口未释放导致“打不开、反复修复”。不要先关窗口再直接运行 `start.ps1`，否则容易遇到端口仍被占用。

---

### 生产部署

- **必须**配置 `JWT_SECRET` 环境变量，且不能使用默认值 `dev_secret_123456`
- 设置 `NODE_ENV=production`
- TypeORM `synchronize` 在生产环境已自动禁用

## 目录结构

```
frontend/   # Vue 3 + Vite + Element Plus
backend/    # NestJS + TypeORM + MySQL
```
