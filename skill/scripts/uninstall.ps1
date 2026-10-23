<#
.SYNOPSIS
    Remove the DSH token-balance chip and its profile entry.

.DESCRIPTION
    Deletes the plugin directory from the active DSH profile, removes the
    `insert` row that mounted it from cordis.patch.yml (timestamped backup kept),
    and removes the companion skill from <DshHome>\skills unless -KeepSkill is
    given. The GUI falls back to its built-in statistics after a page reload.

.PARAMETER DshHome
    Harness config root. Defaults to $env:DSH_HOME, then %USERPROFILE%\.dsh.

.PARAMETER Profile
    Profile directory name under <DshHome>\profiles. Defaults to the first
    existing of: desktop, web.

.PARAMETER KeepSkill
    Leave <DshHome>\skills\<skill> in place so the installer stays available.

.EXAMPLE
    pwsh -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
#>
[CmdletBinding()]
param(
    [string]$DshHome,
    [string]$Profile,
    [switch]$KeepSkill
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

# UTF-8 without BOM (see install.ps1 for the reason).
function Write-Text([string]$Path, [string]$Text) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-Ok([string]$Text) { Write-Host "  [ok] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "  [!] $Text" -ForegroundColor Yellow }

$skillDir = Split-Path -Parent $PSScriptRoot
$skillName = Split-Path -Leaf $skillDir
$skillManifest = Join-Path $skillDir 'SKILL.md'
if (Test-Path $skillManifest) {
    $declared = Select-String -Path $skillManifest -Pattern '^name:\s*([A-Za-z0-9._-]+)\s*$' -List
    if ($declared) { $skillName = $declared.Matches[0].Groups[1].Value }
}

if (-not $DshHome) {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    elseif ($env:USERPROFILE) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
    else { throw 'Cannot determine the DSH home. Pass -DshHome explicitly.' }
}

$profilesRoot = Join-Path $DshHome 'profiles'
if (-not $Profile -and (Test-Path $profilesRoot)) {
    foreach ($candidate in @('desktop', 'web')) {
        if (Test-Path (Join-Path $profilesRoot $candidate)) { $Profile = $candidate; break }
    }
}
if (-not $Profile) { throw "No usable DSH profile found under $profilesRoot." }

$profileDir = Join-Path $profilesRoot $Profile
$patchFile = Join-Path $profileDir 'cordis.patch.yml'
$pluginDir = Join-Path $profileDir 'plugins\token-balance'

Write-Host ''
Write-Host 'DeepSeek Harness - removing token balance chip' -ForegroundColor Cyan
Write-Host "  harness home : $DshHome"
Write-Host "  profile      : $Profile"
Write-Host ''

# --- unpatch the profile entry list -----------------------------------------
if (Test-Path $patchFile) {
    $raw = Get-Content -Raw -Path $patchFile
    $updated = $raw

    if ($raw -match '(?ms)^#\s*>>>\s*token-balance.*?^#\s*<<<\s*token-balance[^\r\n]*\r?\n?') {
        $updated = [regex]::Replace($raw, '(?ms)^#\s*>>>\s*token-balance.*?^#\s*<<<\s*token-balance[^\r\n]*\r?\n?', '')
    }
    elseif ($raw -match '(?m)^\s*-\s*id:\s*["'']?token-balance["'']?\s*$') {
        $lines = [System.Collections.Generic.List[string]]($raw -split "\r?\n")
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*-\s*id:\s*["'']?token-balance["'']?\s*$') {
                $remove = 1
                if ($i + 1 -lt $lines.Count -and $lines[$i + 1] -match '^\s+name:\s*\./plugins/token-balance') { $remove = 2 }
                $lines.RemoveRange($i, $remove)
                break
            }
        }
        $updated = ($lines -join [Environment]::NewLine)
    }

    if ($updated -ne $raw) {
        $backup = "$patchFile.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
        Copy-Item $patchFile $backup -Force
        Write-Text -Path $patchFile -Text $updated
        Write-Ok "removed the token-balance row (backup: $(Split-Path -Leaf $backup))"
    }
    else {
        Write-Warn2 'cordis.patch.yml has no token-balance row; nothing to unpatch'
    }
}

# --- delete the plugin -------------------------------------------------------
if (Test-Path $pluginDir) {
    Remove-Item $pluginDir -Recurse -Force
    Write-Ok "deleted $pluginDir"
}
else {
    Write-Warn2 "plugin directory not present: $pluginDir"
}

# --- delete the skill --------------------------------------------------------
if (-not $KeepSkill) {
    $skillsRoot = Join-Path $DshHome 'skills'
    $skillTarget = Join-Path $skillsRoot $skillName
    $sameTree = $skillDir.TrimEnd('\') -ieq $skillTarget.TrimEnd('\')
    if (-not $sameTree -and (Test-Path $skillTarget)) {
        Remove-Item $skillTarget -Recurse -Force
        Write-Ok "deleted skill $skillTarget"
    }
}

Write-Host ''
Write-Host 'Reload the DeepSeek Harness window (F5). If the host does not pick the' -ForegroundColor Cyan
Write-Host 'change up, restart the app - a running fiber keeps its module loaded.' -ForegroundColor Cyan
Write-Host ''
