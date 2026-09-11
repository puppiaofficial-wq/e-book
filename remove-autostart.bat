@echo off
setlocal
cd /d "%~dp0"
title eBook Studio - 자동 시작 해제

echo.
echo   자동 시작 등록을 해제합니다.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\autostart.ps1" -Here "%~dp0." -Remove
if errorlevel 1 goto FAILED

echo.
echo   해제했습니다. 앞으로는 start.bat 으로 직접 켜시면 됩니다.
echo   지금 켜져 있는 서버는 stop-server.bat 으로 끌 수 있습니다.
echo.
pause
goto END

:FAILED
echo   [!] 해제하지 못했습니다.
echo       시작 프로그램 폴더에서 "eBook Studio" 바로가기를 직접 지워 주세요.
echo       윈도우 키 + R 을 누르고 shell:startup 을 입력하면 열립니다.
echo.
pause

:END
endlocal
