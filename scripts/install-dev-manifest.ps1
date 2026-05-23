param(
    [Parameter(Mandatory = $true)]
    [string]$Bridge,

    [string]$ExtId,

    [switch]$AllBrowsers
)

$ErrorActionPreference = "Stop"
$HostName = "com.snaplex.host"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ExtIdFile = Join-Path $RepoRoot "extension\scripts\dev-extension-id.txt"

if (-not $ExtId -and (Test-Path $ExtIdFile)) {
    $ExtId = (Get-Content $ExtIdFile -Raw).Trim()
}

if (-not $ExtId -or $ExtId -notmatch "^[a-p]{32}$") {
    throw "Invalid or missing extension ID. Pass -ExtId or write it to $ExtIdFile."
}

if (-not (Test-Path $Bridge)) {
    throw "Bridge binary does not exist: $Bridge"
}

$BridgePath = (Resolve-Path $Bridge).Path
$ManifestDir = Join-Path $env:LOCALAPPDATA "Snaplex\NativeMessagingHosts"
$ManifestPath = Join-Path $ManifestDir "$HostName.json"
New-Item -ItemType Directory -Force -Path $ManifestDir | Out-Null

$Manifest = [ordered]@{
    name = $HostName
    description = "Snaplex Native Messaging Host"
    path = $BridgePath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtId/")
}
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path $ManifestPath

$RegistryBases = @("HKCU:\Software\Google\Chrome\NativeMessagingHosts")
if ($AllBrowsers) {
    $RegistryBases += @(
        "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts",
        "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts"
    )
}

foreach ($RegistryBase in $RegistryBases) {
    $Key = Join-Path $RegistryBase $HostName
    New-Item -Force -Path $Key | Out-Null
    Set-Item -Path $Key -Value $ManifestPath
    Write-Host "Installed $Key -> $ManifestPath"
}
