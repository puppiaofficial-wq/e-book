# Registers eBook Studio to start with Windows.
# Called by install-autostart.bat; not meant to be run on its own.
param(
  [Parameter(Mandatory = $true)][string]$Here,
  [switch]$Remove
)

# PowerShell treats -Path as a wildcard pattern, and square brackets in it as a
# character class. A real folder such as "D:\[작업] JPG\..." therefore never
# matches itself, so every path below is handled literally instead.
$Here     = [System.IO.Path]::GetFullPath($Here)
$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = [System.IO.Path]::Combine($startup, 'eBook Studio.lnk')

if ($Remove) {
  if (Test-Path -LiteralPath $shortcut) {
    Remove-Item -LiteralPath $shortcut -Force
    Write-Output 'removed'
  } else {
    Write-Output 'absent'
  }
  exit 0
}

$target = [System.IO.Path]::Combine($Here, 'run-hidden.vbs')
if (-not (Test-Path -LiteralPath $target)) {
  Write-Error "run-hidden.vbs not found in $Here"
  exit 1
}

# wscript runs the launcher with no console window, so the server sits quietly
# in the background instead of leaving a black window open all day.
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
$link.TargetPath       = 'wscript.exe'
$link.Arguments        = '"' + $target + '"'
$link.WorkingDirectory = $Here
$link.Description      = 'eBook Studio'
$link.Save()
Write-Output 'installed'
