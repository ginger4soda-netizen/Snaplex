param(
    [switch]$AllBrowsers
)

$ErrorActionPreference = "Stop"
$HostName = "com.snaplex.host"

$RegistryBases = @("HKCU:\Software\Google\Chrome\NativeMessagingHosts")
if ($AllBrowsers) {
    $RegistryBases += @(
        "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts",
        "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts"
    )
}

foreach ($RegistryBase in $RegistryBases) {
    $Key = Join-Path $RegistryBase $HostName
    if (Test-Path $Key) {
        Remove-Item -Recurse -Force $Key
        Write-Host "Removed $Key"
    }
}

$ManifestPath = Join-Path $env:LOCALAPPDATA "Snaplex\NativeMessagingHosts\$HostName.json"
if (Test-Path $ManifestPath) {
    Remove-Item -Force $ManifestPath
    Write-Host "Removed $ManifestPath"
}
