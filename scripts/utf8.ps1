# 仅影响当前 PowerShell 进程：统一控制台输入、输出与管道编码为 UTF-8。
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$global:OutputEncoding = $utf8

Write-Host '当前 PowerShell 会话已切换为 UTF-8。'
