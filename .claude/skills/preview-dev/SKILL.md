---
name: preview-dev
description: 启动前端开发服务器并打开浏览器预览。当用户想要"看改动效果""启动预览""开发服务器"或"查看实时变化"时使用。支持 Cursor、Codex、Claude Code 的统一启动方式。
compatibility: Node.js, npm, 浏览器
---

## 用途

快速启动前端开发环境并在浏览器中预览应用。统一 Cursor、Codex、Claude Code 的启动方式，避免工具间差异。

## 执行步骤

用两次独立 Bash 调用分别启动，**不要在一个命令里使用多个 cd**（Claude Code 会拦截）：

**第一次调用（启动后端）：**
```bash
npm run start:dev --prefix "E:/1.Cursor-Project/6. hyfsmes/backend" > /tmp/backend.log 2>&1 &
```

**第二次调用（启动前端）：**
```bash
npm run dev --prefix "E:/1.Cursor-Project/6. hyfsmes/frontend" > /tmp/frontend.log 2>&1 &
```

等待 5 秒后，打开浏览器到 `http://localhost:5173`。

## 何时使用

- "启动预览" / "开启开发服务器"
- "看一下改动效果" / "实时查看"
- "打开 localhost 看一下"
- 任何需要看前端实时效果的任务

## 注意事项

- 开发服务器默认监听 `localhost:5173`
- 如果 5173 端口已被占用，npm 会自动使用下一个可用端口（如 5174）
- 开发服务器运行期间，所有前端代码改动会自动热更新
- 如需停止服务器，在终端按 `Ctrl+C`

## 示例

**用户说：** "我改完了，给我看一下效果"

**我的执行：**
```bash
cd frontend && npm run dev
# 等待服务器启动...
# 打开浏览器到 http://localhost:5173
```

然后用户可以在浏览器中实时看到改动。
