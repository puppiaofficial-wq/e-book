# 카페24에 카탈로그 올리기

처음 한 번은 약 30분, 두 번째부터는 약 5분 걸립니다. 추가 비용은 없습니다.

## 시작하기 전에 딱 하나만 확인

카페24는 상품이 여러 가지라, 어디에 올리느냐에 따라 방법이 달라집니다.

| 상품 | 가능 여부 |
| --- | --- |
| **이미지 호스팅** (현재 구독 중) | **불가**. 이미지 전용이라 뷰어(HTML)를 올려도 웹페이지로 열리지 않습니다 |
| **쇼핑몰 웹FTP** | **가능**. `/web/upload/` 폴더에 올려서 바로 서비스합니다. 이 문서가 이 방법입니다 |
| **Cloudflare Pages** | 가능. 쇼핑몰이 없거나 위 방법이 안 될 때. 무료이고 더 간단합니다 |

## 준비물

1. Node.js 가 설치된 컴퓨터
2. e북 프로그램 폴더 (`start.bat` 이 보이는 폴더)
3. 카탈로그 원본 PDF (양면 대지도 그대로)
4. FileZilla
5. 카페24 쇼핑몰 관리자 아이디와 비밀번호

---

## PART A. 내 컴퓨터에서 파일 만들기

여기까지는 인터넷에 아무것도 올라가지 않습니다.

### 1. PDF를 catalogs 폴더에 넣기

```
ebook-studio\
 ├─ catalogs\
 │   └─ PUPPIA 2026FW.pdf     ← 여기에 넣습니다
 ├─ start.bat
 └─ ...
```

파일 이름이 그대로 카탈로그 제목이 됩니다.

### 2. start.bat 더블클릭

검은 창에서 준비와 변환이 자동으로 진행됩니다. 68페이지 기준 40초 정도입니다.
끝나면 브라우저가 저절로 열립니다.

> 검은 창은 닫지 마세요. 닫으면 프로그램이 꺼집니다.

### 3. 제목과 주소를 정하고 Publish

카탈로그 카드를 클릭 → **Overview** 탭에서 두 가지를 정합니다.

| 항목 | 내용 |
| --- | --- |
| Title | 바이어에게 보일 이름. 예) PUPPIA 2026 F/W |
| Web address | 주소에 쓰일 영문. 예) `2026fw` |

**Save changes** 를 누른 뒤, 오른쪽 위 빨간 **Publish** 버튼을 누릅니다.

> Web address 는 한 번 정하면 바꾸지 마세요. 보낸 링크가 전부 끊어집니다.

### 4. 업로드용 파일 만들기

검은 창에 입력합니다.

```
npm run export
```

프로그램 폴더 안에 `export` 폴더가 생깁니다.

```
export\
 └─ 2026fw\
     ├─ index.html      ← 뷰어 화면
     ├─ viewer.js
     ├─ viewer.css
     ├─ text.json
     ├─ pages\          ← 페이지 이미지
     ├─ zoom\           ← 확대용 이미지
     └─ thumbs\         ← 미리보기
```

이 폴더 하나가 완성된 웹사이트입니다.

---

## PART B. 카페24에 올리기

### 5. 1분 테스트 — 진짜 열리는지 확인

쇼핑몰 관리자 → **FTP → 웹FTP → 웹FTP 접속** (아이디·비밀번호는 관리자 것과 동일)

`/web/upload/` 로 이동해서 `export\2026fw\index.html` 파일 하나만 올려 봅니다.
그리고 브라우저에서 엽니다.

```
https://내아이디.cafe24.com/web/upload/index.html
```

화면이 열리면 통과입니다. 이미지가 없어 빈 화면이어도, 파일이 다운로드되지 않고
브라우저에서 열리기만 하면 됩니다.

> 파일이 다운로드되어 버리면 이 방법은 안 되는 것입니다.
> 아래 Cloudflare Pages 방법으로 넘어가세요. 테스트 파일은 지워 주세요.

### 6. FileZilla 접속 정보 준비

파일이 200개가 넘어서 웹FTP로는 오래 걸립니다.

| 항목 | 값 |
| --- | --- |
| 호스트 | `내아이디.cafe24.com` |
| 사용자명 | 쇼핑몰 관리자 아이디 |
| 비밀번호 | 쇼핑몰 관리자 비밀번호 |
| 포트 | 21 (비워도 됨) |

FTP를 처음 쓰신다면 관리자에서 **FTP 사용 신청**을 먼저 해야 할 수 있습니다.

### 7. FileZilla로 접속

빠른 연결로 접속한 뒤, 오른쪽(서버)에서 `web` → `upload` 폴더로 들어갑니다.

### 8. 폴더 만들고 통째로 올리기

`/web/upload/` 안에서 오른쪽 버튼 → **디렉터리 만들기** 로 `ebook` 폴더를 만들고 들어갑니다.
왼쪽에서 `export\2026fw` 폴더를 통째로 끌어다 놓습니다.

68페이지 기준 약 30~50MB, 2~10분 걸립니다.
FileZilla 아래쪽 **실패한 전송** 탭이 비어 있어야 완료된 것입니다.

### 9. 열어 보기

```
https://내아이디.cafe24.com/web/upload/ebook/2026fw/index.html
```

페이지 넘김, 목차, 검색을 눌러 보고 휴대폰에서도 확인해 보세요.

---

## PART C. 이제 이걸로 하는 일

### 바이어에게 보내기

9번의 주소를 메일이나 메신저에 그대로 붙여 넣습니다.

### 바이어마다 다른 주소를 주고 싶다면

```
npm run export -- 2026fw --out export/9f3a2c71
```

`9f3a2c71` 은 아무 글자나 됩니다. 주소가 `.../ebook/9f3a2c71/2026fw/index.html` 이 됩니다.
회수하려면 FileZilla에서 그 폴더만 지우면 됩니다.

### 홈페이지 안에 넣기

```html
<iframe src="https://내아이디.cafe24.com/web/upload/ebook/2026fw/index.html"
        style="width:100%;aspect-ratio:16/10;border:0"
        allowfullscreen loading="lazy"></iframe>
```

---

## 다음 시즌부터는 3단계

1. `catalogs` 폴더에 새 PDF를 넣고 `start.bat` 실행
2. 관리자에서 제목·주소 정하고 Publish, 검은 창에 `npm run export`
3. FileZilla로 `ebook` 폴더에 새 폴더만 끌어다 놓기

## 안 될 때

| 증상 | 해결 |
| --- | --- |
| 화면이 하얗게만 나옴 | 주소 끝에 `/index.html` 을 붙였는지 확인 |
| 글자만 나오고 이미지가 없음 | `pages`, `zoom`, `thumbs` 폴더가 함께 올라갔는지 확인 |
| 파일이 다운로드되어 버림 | 카페24가 HTML을 웹페이지로 안 내보내는 경우. Cloudflare Pages 로 |
| 일부 페이지만 안 보임 | FileZilla **실패한 전송** 탭에서 다시 시도 |
| 검은 창에 npm 오류 | Node.js 설치 후 컴퓨터를 재시작하지 않은 경우 |

## 카페24가 안 될 때 — Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) 에서 무료 계정 생성
2. **Workers & Pages → Create → Pages → Upload assets**
3. 프로젝트 이름을 정하고 `export\2026fw` 폴더를 끌어다 놓기
4. `이름.pages.dev` 주소가 바로 나옵니다

정적 파일은 트래픽 요금이 없고, 전 세계 CDN이라 해외 바이어에게도 빠릅니다.
가지고 계신 도메인을 연결할 수도 있습니다.
