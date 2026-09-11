# Registers eBook Studio to start with Windows.
# Called by install-autostart.bat; not meant to be run on its own.
param(
  [Parameter(Mandatory = $true)][string]$Here,
  [switch]$Remove
)

$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup 'eBook Studio.lnk'

if ($Remove) {
  if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Output 'removed'
  } else {
    Write-Output 'absent'
  }
  exit 0
}

$target = Join-Path $Here 'run-hidden.vbs'
if (-not (Test-Path $target)) {
  Write-Error "run-hidden.vbs not found in $Here"
  exit 1
}

# wscript runs the launcher with no console window, so the server sits quietly
# in the background instead of leaving a black window open all day.
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
$link.TargetPath        = 'wscript.exe'
$link.Arguments         = '"' + $target + '"'
$link.WorkingDirectory  = $Here
$link.Description       = 'eBook Studio'
$link.Save()
Write-Output 'installed'
