# 工序正式上线清单

## 本地已完成

- 旧系统工序导入脚本已准备好：
  - `backend/scripts/import-old-production-processes.js`
- 工序树同步脚本已准备好：
  - `backend/scripts/sync-production-process-tree.js`
- 工序分类规则已抽到统一分类器：
  - `backend/scripts/utils/production-process-normalizer.js`
- 本地前后端已成功构建：
  - `backend`: `npm run build`
  - `frontend`: `npm run build`

## 上线前你需要准备

### 1. 代码

把当前代码推到正式服务器对应分支，并在服务器拉最新代码。

涉及的关键文件：

- `backend/scripts/import-old-production-processes.js`
- `backend/scripts/sync-production-process-tree.js`
- `backend/scripts/utils/production-process-normalizer.js`
- 以及你这次要一起上线的其它前后端改动

### 2. 旧系统导出文件

正式服务器上需要能访问这份旧系统导出文件：

- `erp_work_processes.tsv`

建议放到：

- `docs/migration-samples/production-processes/erp_work_processes.tsv`

## 正式上线步骤

### Step 1. 备份新系统正式库

先备份正式库，确认备份文件生成成功后再继续。

### Step 2. 更新代码

在正式服务器项目目录执行：

```bash
git pull
```

### Step 3. 安装依赖（如本次服务器代码有变更需要）

如果线上环境已经安装过依赖且未变更，可跳过。

### Step 4. 构建前后端

后端：

```bash
cd backend
npm run build
```

前端：

```bash
cd ../frontend
npm run build
```

### Step 5. 导入旧系统工序到正式新库

在项目根目录执行：

```bash
cd backend
node scripts/import-old-production-processes.js
```

### Step 6. 重建生产工序树

仍在 `backend` 目录执行：

```bash
node scripts/sync-production-process-tree.js
```

### Step 7. 重启服务

按你线上当前使用的启动方式重启前后端服务。

## 上线后验证

进入新系统：

- `订单设置 > 生产工序`

重点验证：

1. 是否能看到 `裁床 / 车缝 / 尾部` 三个部门
2. 展开 `裁床` 是否能看到旧系统导入的裁床工序
3. 展开 `尾部` 是否能看到 `包装 / 大烫 / 查货 / 剪线 / 专机 / 手工` 等工种
4. 搜索几个旧系统工序名，确认价格也在

## 说明

- 本地数据库里已经看到的导入结果，不会自动跟着代码上线到正式库。
- 正式库必须手动执行上面两个脚本，数据才会真的进入线上系统。
- 如果线上执行后页面仍异常，优先保留数据库备份并回传脚本输出日志。
