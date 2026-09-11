@echo off
setlocal
title eBook Studio - 서버 끄기

echo.
echo   eBook Studio 서버를 끕니다.
echo.

set EBPORT=8080
set FOUND=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%EBPORT%" ^| findstr LISTENING') do set FOUND=%%a

if not defined FOUND goto NOTRUNNING

taskkill /PID %FOUND% /F >nul 2>nul
if errorlevel 1 goto FAILED
echo   껐습니다.
echo.
echo   다시 켜려면 start.bat 또는 run-hidden.vbs 를 실행하세요.
echo.
pause
goto END

:NOTRUNNING
echo   서버가 켜져 있지 않습니다.
echo.
pause
goto END

:FAILED
echo   [!] 끄지 못했습니다. 작업 관리자에서 node.exe 를 종료해 주세요.
echo.
pause

:END
endlocal
