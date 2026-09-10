@echo off
chcp 65001 >nul
title eBook Studio
cd /d "%~dp0"

echo.
echo   ==========================================
echo    eBook Studio 시작
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js 가 설치되어 있지 않습니다.
  echo.
  echo   브라우저에서 nodejs.org 를 열어드립니다.
  echo   "LTS" 버전을 내려받아 설치한 뒤, 이 창을 닫고
  echo   start.bat 을 다시 실행해 주세요.
  echo.
  start https://nodejs.org/ko/download
  pause
  exit /b 1
)

if not exist node_modules (
  echo   최초 실행 준비 중입니다. 1~3분 정도 걸립니다...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [!] 준비 중 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)

echo.
echo   catalogs 폴더의 PDF를 확인합니다...
echo.
call npm run --silent autoimport

echo.
echo   ------------------------------------------
echo    관리자 화면 : http://localhost:8080/admin
echo    카탈로그 목록 : http://localhost:8080/library
echo.
echo    이 창을 닫으면 서버가 종료됩니다.
echo   ------------------------------------------
echo.

start http://localhost:8080/admin
node server/index.js
pause
