. "$PSScriptRoot\utf8.ps1"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm dev
} else {
    Write-Error '未找到 pnpm。请先启用 Corepack：corepack enable'
    exit 1
}

