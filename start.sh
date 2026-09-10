#!/bin/bash
# Linux: ./start.sh 로 실행합니다.
cd "$(dirname "$0")" || exit 1

echo
echo "  =========================================="
echo "   eBook Studio 시작"
echo "  =========================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Node.js 가 설치되어 있지 않습니다."
  echo "      nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  xdg-open https://nodejs.org/ko/download 2>/dev/null
  read -r -p "  엔터를 누르면 창이 닫힙니다."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  최초 실행 준비 중입니다. 1~3분 정도 걸립니다..."
  npm install || { echo "  [!] 준비 중 오류가 발생했습니다."; read -r; exit 1; }
fi

echo
echo "  catalogs 폴더의 PDF를 확인합니다..."
echo
npm run --silent autoimport

echo
echo "  ------------------------------------------"
echo "   관리자 화면   : http://localhost:8080/admin"
echo "   카탈로그 목록 : http://localhost:8080/library"
echo
echo "   이 창을 닫으면 서버가 종료됩니다."
echo "  ------------------------------------------"
echo

(sleep 2 && xdg-open http://localhost:8080/admin) &
node server/index.js
