# PreToolUse 钩子：拦截 git push，提醒先写入"系统更新"条目。
#
# 触发：Claude Code 的 Bash 工具准备执行命令时，命令含 `git push`。
# 行为：
#   - 命令含 SKIP_UPDATES_CHECK -> 放行（手动豁免）
#   - 未推送提交 / 工作区里包含 frontend/src/data/updates.ts -> 放行
#   - 否则 exit 2 + 写 stderr，将提示返还给 Claude，让其先草拟更新文案并征求确认
#
# 不会影响 git 命令行人工执行 —— 只在 Claude Code 会话内拦截。
#
# 注意：PS 5.1 + 中文路径需 UTF-8 BOM；用 2>$null 重定向 git 的 stderr 会被包成
# ErrorRecord，所以本脚本一律不重定向 git stderr，靠 -c core.autocrlf=false 抑制 CRLF 警告。

# 1) 读 stdin（Claude Code 注入的 JSON）
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$cmd = $null
if ($payload -and $payload.tool_input) {
    $cmd = [string]$payload.tool_input.command
}
if (-not $cmd) { exit 0 }

# 2) 只对 git push 生效
if ($cmd -notmatch '(?i)\bgit\s+push\b') { exit 0 }

# 3) 显式豁免
if ($cmd -match 'SKIP_UPDATES_CHECK') { exit 0 }

# 4) 检查未推送提交 / 工作区是否动过 updates.ts
$target = 'frontend/src/data/updates.ts'

function Test-TargetInGitList {
    param([string[]]$GitArgs, [string]$Target)
    $output = & git -c core.autocrlf=false @GitArgs
    if ($LASTEXITCODE -ne 0) { return $false }
    foreach ($line in @($output)) {
        if ($line -and ($line.ToString().Trim() -eq $Target)) { return $true }
    }
    return $false
}

$touched = $false

# 4a) 未推送提交（有上游时）
$null = & git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
if ($LASTEXITCODE -eq 0) {
    if (Test-TargetInGitList -GitArgs @('log', '@{u}..HEAD', '--name-only', '--pretty=format:') -Target $target) {
        $touched = $true
    }
}

# 4b) 已暂存
if (-not $touched) {
    if (Test-TargetInGitList -GitArgs @('diff', '--cached', '--name-only') -Target $target) {
        $touched = $true
    }
}

# 4c) 工作区未暂存
if (-not $touched) {
    if (Test-TargetInGitList -GitArgs @('diff', '--name-only') -Target $target) {
        $touched = $true
    }
}

# 4d) 未跟踪（新建文件首次提交前会落在这里）
if (-not $touched) {
    if (Test-TargetInGitList -GitArgs @('ls-files', '--others', '--exclude-standard') -Target $target) {
        $touched = $true
    }
}

if ($touched) { exit 0 }

# 5) 没动过 -> 拦下并提示 Claude
$lines = @(
    '[update-bell] 本次 git push 的未推送提交里没有改动 frontend/src/data/updates.ts。',
    '',
    '操作要求：',
    '1. 先 `git log @{u}..HEAD --oneline` 看未推送提交清单；',
    '2. 再翻 `git diff @{u}..HEAD --stat` 找出用户能感知的功能 / 交互变更（纯后端 / 重构 / 测试 / 文档不算）；',
    '3. 按 frontend/src/data/updates.ts 里 SystemUpdate 类型，草拟更新条目（date 用今天、id 用 `YYYY-MM-DD-短描述-英文`、module 从枚举挑、标题动词开头 ≤20 字、说明站在用户视角讲怎么用 / 解决什么）；',
    '4. 把草稿列给用户确认 / 修改，定稿后追加到 systemUpdates 数组顶部，提交，再重新 git push。',
    '',
    '若本次确认无用户可见变更（纯后端 / 重构 / 小修 / 文档），跟用户说明一句，然后在 git push 命令末尾追加注释 `# SKIP_UPDATES_CHECK` 即可放行。'
)

[Console]::Error.WriteLine(($lines -join [Environment]::NewLine))
exit 2
