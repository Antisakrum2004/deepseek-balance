<#
.SYNOPSIS
    Install the DSH token-balance chip: DeepSeek balance + estimated spend in the
    chat composer dock of DeepSeek Harness.

.DESCRIPTION
    Copies the plugin into the active DSH profile, adds one `insert` row to that
    profile's cordis.patch.yml, and installs the companion skill into
    $DSH_HOME\skills so the assistant can reinstall or remove it later.

    The operation is idempotent: running it again only refreshes the plugin files.
    Every write to cordis.patch.yml is preceded by a timestamped backup.

.PARAMETER DshHome
    Harness config root. Defaults to $env:DSH_HOME, then %USERPROFILE%\.dsh.

.PARAMETER Profile
    Profile directory name under <DshHome>\profiles. Defaults to the first
    existing of: desktop, web.

.PARAMETER NoSkill
    Skip installing the companion skill into <DshHome>\skills.

.EXAMPLE
    pwsh -ExecutionPolicy Bypass -File .\scripts\install.ps1

.NOTES
    Requires PowerShell 7 (pwsh) or Windows PowerShell 5.1. No internet access
    is needed at install time; the chip calls api.deepseek.com at runtime.
#>
[CmdletBinding()]
param(
    [string]$DshHome,
    [string]$Profile,
    [switch]$NoSkill
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

$Marker = '# >>> token-balance'

# Write UTF-8 without a BOM: Windows PowerShell 5.1's -Encoding utf8 adds one, and
# a BOM in front of a YAML list is an unnecessary risk for the loader.
function Write-Text([string]$Path, [string]$Text) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-Step([string]$Text) { Write-Host "  $Text" }
function Write-Ok([string]$Text) { Write-Host "  [ok] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "  [!] $Text" -ForegroundColor Yellow }

# --- resolve locations -------------------------------------------------------
$skillDir = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $skillDir 'assets\plugin'

# The installed directory name must equal the skill's declared name: the catalog
# shows that name, but the folder is what the user sees under <DSH_HOME>\skills.
$skillName = Split-Path -Leaf $skillDir
$skillManifest = Join-Path $skillDir 'SKILL.md'
if (Test-Path $skillManifest) {
    $declared = Select-String -Path $skillManifest -Pattern '^name:\s*([A-Za-z0-9._-]+)\s*$' -List
    if ($declared) { $skillName = $declared.Matches[0].Groups[1].Value }
}
if (-not (Test-Path (Join-Path $sourceDir 'lib\index.js'))) {
    throw "Plugin sources are missing: $sourceDir. Keep the skill bundle intact and run this script from inside it."
}

if (-not $DshHome) {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    elseif ($env:USERPROFILE) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
    else { throw 'Cannot determine the DSH home. Pass -DshHome explicitly.' }
}
if (-not (Test-Path $DshHome)) { throw "DSH home not found: $DshHome. Start DeepSeek Harness once, then retry." }

$profilesRoot = Join-Path $DshHome 'profiles'
if (-not (Test-Path $profilesRoot)) { throw "No profiles directory under $DshHome. Start DeepSeek Harness once, then retry." }

if (-not $Profile) {
    foreach ($candidate in @('desktop', 'web')) {
        if (Test-Path (Join-Path $profilesRoot $candidate)) { $Profile = $candidate; break }
    }
}
if (-not $Profile) {
    $available = (Get-ChildItem $profilesRoot -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', '
    throw "No usable DSH profile found under $profilesRoot (saw: $available)."
}

$profileDir = Join-Path $profilesRoot $Profile
$pluginTarget = Join-Path $profileDir 'plugins\token-balance'
$patchFile = Join-Path $profileDir 'cordis.patch.yml'

Write-Host ''
Write-Host 'DeepSeek Harness - token balance chip' -ForegroundColor Cyan
Write-Host "  harness home : $DshHome"
Write-Host "  profile      : $Profile"
Write-Host ''

# --- copy the plugin ---------------------------------------------------------
New-Item -ItemType Directory -Force (Join-Path $pluginTarget 'lib') | Out-Null
Copy-Item (Join-Path $sourceDir 'package.json') (Join-Path $pluginTarget 'package.json') -Force
Copy-Item (Join-Path $sourceDir 'lib\index.js') (Join-Path $pluginTarget 'lib\index.js') -Force
Copy-Item (Join-Path $sourceDir 'lib\client.js') (Join-Path $pluginTarget 'lib\client.js') -Force
Write-Ok "plugin files -> $pluginTarget"

# --- patch the profile entry list -------------------------------------------
# The first element is parenthesised on purpose: the comma operator binds tighter
# than '+', so `$Marker + 'text',` would append the REST OF THE ARRAY to the string
# (joined with spaces) instead of creating a list element.
$block = @(
    ($Marker + ' (managed by install.ps1 - do not edit by hand)'),
    '- insert:',
    '    - id: token-balance',
    '      name: ./plugins/token-balance/lib/index.js',
    '# <<< token-balance'
) -join [Environment]::NewLine

if (-not (Test-Path $patchFile)) {
    Write-Text -Path $patchFile -Text ($block + [Environment]::NewLine)
    Write-Ok "created $patchFile"
}
else {
    $raw = Get-Content -Raw -Path $patchFile
    if ($raw -match '(?m)^\s*-\s*id:\s*["'']?token-balance["'']?\s*$') {
        Write-Ok 'cordis.patch.yml already lists token-balance (left untouched)'
    }
    else {
        $backup = "$patchFile.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
        Copy-Item $patchFile $backup -Force
        $trimmed = $raw.TrimEnd()
        $separator = if ($trimmed.Length -eq 0) { '' } else { [Environment]::NewLine }
        Write-Text -Path $patchFile -Text ($trimmed + $separator + $block + [Environment]::NewLine)
        Write-Ok "patched cordis.patch.yml (backup: $(Split-Path -Leaf $backup))"
    }
}

# --- install the companion skill --------------------------------------------
if (-not $NoSkill) {
    $skillsRoot = Join-Path $DshHome 'skills'
    $skillTarget = Join-Path $skillsRoot $skillName
    $sameTree = $skillDir.TrimEnd('\') -ieq $skillTarget.TrimEnd('\')
    if ($sameTree) {
        Write-Ok 'skill already lives in the user skill root'
    }
    else {
        New-Item -ItemType Directory -Force $skillTarget | Out-Null
        Copy-Item (Join-Path $skillDir '*') $skillTarget -Recurse -Force
        Write-Ok "skill -> $skillTarget"
    }
}

Write-Host ''
Write-Host 'Next steps' -ForegroundColor Cyan
Write-Step '1. Open (or refresh with F5) the DeepSeek Harness window.'
Write-Step '2. Under the message box, next to the token statistics, you should see your'
Write-Step '   balance and the session spend, e.g.  yuan 24.93 / $2.24 | spent yuan 0.07 / <$0.01'
Write-Step '3. Click that line for the full breakdown.'
Write-Host ''
Write-Step 'The chip appears only when the GUI is reloaded: client bundles are read at page load.'
Write-Step "Uninstall later with: powershell -ExecutionPolicy Bypass -File `"$(Join-Path $skillDir 'scripts\uninstall.ps1')`""
Write-Host ''
