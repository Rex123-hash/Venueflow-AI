Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $repoRoot "frontend"
$nodeDir = "C:\Program Files\nodejs"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"

if (-not (Test-Path $nodeExe)) {
    throw "Node.js was not found at $nodeExe"
}

if (-not (Test-Path $npmCmd)) {
    throw "npm.cmd was not found at $npmCmd"
}

# Make sure both this script and child npm processes can resolve Node.
if (($env:Path -split ";") -notcontains $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
}

$globalNodeModules = Join-Path $env:APPDATA "npm\node_modules"
$env:NODE_PATH = if (Test-Path $globalNodeModules) {
    "$nodeDir\node_modules;$globalNodeModules"
} else {
    "$nodeDir\node_modules"
}

Write-Host "Building frontend in $frontendDir..."
Push-Location $frontendDir
try {
    & $npmCmd run build
} finally {
    Pop-Location
}

Write-Host "Deploying to Cloud Run..."
Push-Location $repoRoot
try {
    gcloud run deploy venue-flow-ai --source . --region asia-south1 --allow-unauthenticated
} finally {
    Pop-Location
}
