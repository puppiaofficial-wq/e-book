@echo off
setlocal
cd /d "%~dp0"
title eBook Studio

echo.
echo   ==========================================
echo    eBook Studio
echo   ==========================================
echo.

if not exist package.json goto WRONGDIR

where node >nul 2>nul
if errorlevel 1 goto NONODE

if exist node_modules goto SKIPINSTALL
echo   [1/3] 최초 실행 준비 중입니다. 1~3분 정도 걸립니다.
echo         이 단계는 처음 한 번만 실행됩니다.
echo.
call npm install
if errorlevel 1 goto INSTALLFAIL
:SKIPINSTALL

echo.
echo   [2/3] catalogs 폴더의 PDF를 확인합니다.
echo.
call npm run --silent autoimport

echo.
echo   [3/3] 서버를 시작합니다.
echo.
echo   ------------------------------------------
echo    관리자 화면   : http://localhost:8080/admin
echo    카탈로그 목록 : http://localhost:8080/library
echo.
echo    이 창을 닫으면 서비스가 종료됩니다.
echo   ------------------------------------------
echo.

start "" http://localhost:8080/admin
node server/index.js

echo.
echo   서버가 종료되었습니다.
pause
goto END

:WRONGDIR
echo   [!] 이 폴더에서는 실행할 수 없습니다.
echo.
echo   압축을 푼 폴더 안에 폴더가 하나 더 들어 있는 경우가 있습니다.
echo   package.json 파일이 함께 보이는 폴더의 start.bat 을 실행해 주세요.
echo.
pause
goto END

:NONODE
echo   [!] Node.js 가 설치되어 있지 않습니다.
echo.
echo   브라우저에서 nodejs.org 를 엽니다.
echo   LTS 버전을 설치하고 컴퓨터를 재시작한 뒤
echo   start.bat 을 다시 실행해 주세요.
echo.
start "" https://nodejs.org/ko/download
pause
goto END

:INSTALLFAIL
echo.
echo   [!] 준비 중 오류가 발생했습니다.
echo       인터넷 연결을 확인한 뒤 다시 실행해 주세요.
pause
goto END

:END
