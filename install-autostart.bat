@echo off
setlocal
cd /d "%~dp0"
title eBook Studio - 자동 시작 등록

echo.
echo   ==========================================
echo    eBook Studio 자동 시작 등록
echo   ==========================================
echo.
echo   컴퓨터를 켤 때마다 서버가 조용히 켜지도록 등록합니다.
echo   앞으로는 start.bat 을 누를 필요 없이, 즐겨찾기만 열면
echo   바로 관리자 화면이 나옵니다.
echo.

if not exist package.json goto WRONGDIR

where node >nul 2>nul
if errorlevel 1 goto NONODE

if exist node_modules goto SKIPINSTALL
echo   최초 준비 중입니다. 1~3분 정도 걸립니다.
echo.
call npm install
if errorlevel 1 goto INSTALLFAIL
:SKIPINSTALL

if not exist "%~dp0run-hidden.vbs" goto NOVBS

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\autostart.ps1" -Here "%~dp0."
if errorlevel 1 goto FAILED

echo.
echo   등록했습니다. 이제 서버를 켭니다.
start "" wscript.exe "%~dp0run-hidden.vbs"

echo   잠시 기다린 뒤 관리자 화면을 엽니다.
timeout /t 5 /nobreak >nul
start "" http://localhost:8080/admin

echo.
echo   ------------------------------------------
echo    이 주소를 즐겨찾기에 추가해 두세요.
echo    http://localhost:8080/admin
echo.
echo    서버 끄기      : stop-server.bat
echo    자동 시작 해제 : remove-autostart.bat
echo   ------------------------------------------
echo.
pause
goto END

:WRONGDIR
echo   [!] 이 파일은 eBook Studio 폴더 안에서 실행해야 합니다.
echo.
pause
goto END

:NONODE
echo   [!] Node.js 가 설치되어 있지 않습니다.
echo       https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
echo.
pause
goto END

:INSTALLFAIL
echo   [!] 준비 중 문제가 생겼습니다. 인터넷 연결을 확인하고 다시 실행하세요.
echo.
pause
goto END

:NOVBS
echo   [!] run-hidden.vbs 파일이 폴더에 없습니다.
echo       내려받은 파일이 일부만 풀린 것 같습니다.
echo       압축을 다시 풀고 실행해 주세요.
echo.
pause
goto END

:FAILED
echo   [!] 자동 시작 등록에 실패했습니다.
echo       start.bat 으로 계속 사용하실 수 있습니다.
echo.
pause

:END
endlocal
