# Cloudflare Pages에 카탈로그 올리기

명령어를 입력하는 단계가 없습니다. 버튼 몇 번과 파일 하나 끌어다 놓기가 전부입니다.
처음 한 번은 약 20분, 두 번째부터는 약 5분 걸립니다. 비용은 0원입니다.

## 먼저, "검은 창"이 뭔가요

`start.bat` 을 더블클릭하면 뜨는 까만 창입니다. 그 안에서 프로그램이 돌아가고 있는 중입니다.

**거기에는 아무것도 입력하지 않으셔도 됩니다.** 그냥 켜 두시고, 작업이 끝나면 닫으세요.
닫으면 관리자 화면도 같이 꺼집니다.

## 준비물

1. e북 프로그램 폴더 — GitHub에서 **최신 버전**을 다시 받으세요. 내보내기 버튼은 새로 추가된 기능입니다
2. 카탈로그 원본 PDF — 양면(대지)도 그대로
3. Cloudflare 계정 — 5번에서 1분이면 만듭니다
4. 인터넷

---

## PART A. 내 컴퓨터에서 카탈로그 만들기

### 1. PDF를 catalogs 폴더에 넣기

```
ebook-studio\
 ├─ catalogs\
 │   └─ PUPPIA 2026FW.pdf     ← 여기에 넣습니다
 ├─ start.bat
 └─ ...
```

파일 이름이 그대로 카탈로그 제목이 됩니다.

### 2. start.bat 더블클릭하고 기다리기

68페이지 기준 40초 정도입니다. 끝나면 브라우저가 저절로 열립니다.

이미 검은 창이 켜져 있다면 다시 켤 필요 없이 `localhost:8080/admin` 을 여시면 됩니다.

### 3. 제목과 주소를 정하고 Publish

카탈로그 카드 클릭 → **Overview** 탭

| 항목 | 내용 |
| --- | --- |
| Title | 바이어에게 보일 이름. 예) PUPPIA 2026 F/W |
| Web address | 주소에 쓰일 영문. 예) `2026fw` |

**Save changes** 를 누른 뒤, 오른쪽 위 빨간 **Publish** 버튼을 누릅니다.

### 4. Embed 탭에서 .zip 내려받기

**Embed on your site** 탭 → 아래로 내리면 **Publish without a server** 칸

* Zoom image quality 는 `3600 px` 그대로 두세요
* **Prepare download** 를 누르면 진행 막대가 찹니다. 68페이지 기준 3~4분
* 끝나면 **Download .zip** 버튼이 나타납니다

다운로드 폴더에 `2026fw.zip` 이 생깁니다. **압축을 풀지 마세요.** 그대로 씁니다.

---

## PART B. Cloudflare에 올리기

### 5. 계정 만들기

[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 에서 이메일과 비밀번호로 가입하고,
받은 메일의 인증 링크를 누릅니다.

> 카드 정보를 넣으라는 화면이 나오면 건너뛰세요. 무료 요금제로 충분합니다.

### 6. 업로드 화면까지 들어가기

1. 왼쪽 메뉴 **Compute** 안의 **Workers & Pages**
2. 오른쪽 위 **Create**
3. **Upload assets** 를 고르고 **Get started**

> **Connect to Git** 이나 **Import a repository** 는 개발자용입니다. **Upload assets** 쪽입니다.
> Cloudflare가 화면을 자주 바꿉니다. **Pages** 탭이 보이면 그쪽으로 가셔도 결과는 같습니다.

### 7. 이름 정하고 zip 끌어다 놓기

프로젝트 이름을 영문 소문자로 짧게 정합니다. 예) `puppia-2026fw`

> **이름 칸을 꼭 확인하세요.** 그냥 넘어가면 `wandering-sea-a5b3` 같은 아무 말이나
> 자동으로 붙고, 그게 그대로 바이어에게 보낼 주소가 됩니다.
> 이미 그렇게 만드셨다면 지우고 다시 만드는 편이 빠릅니다.

다음 화면에 4번에서 받은 zip 파일을 끌어다 놓고 **Deploy site** 를 누릅니다.
30MB 기준 1~3분 걸립니다.

### 8. 열어 보기

```
https://puppia-catalog.pages.dev
```

페이지 넘김, 목차, 검색, 확대를 눌러 보고 휴대폰에서도 확인해 보세요.

---

## PART C. 이제 이걸로 하는 일

### 바이어에게 보내기

주소를 메일이나 메신저에 그대로 붙여 넣습니다.

### 특정 페이지부터 열리게 하기

```
https://puppia-catalog.pages.dev#p=23
```

### 홈페이지 안에 넣기

```html
<iframe src="https://puppia-catalog.pages.dev"
        style="width:100%;aspect-ratio:16/10;border:0"
        allowfullscreen loading="lazy"></iframe>
```

### 내 도메인 붙이기

프로젝트 화면의 **Custom domains** 에서 `catalog.puppia.com` 같은 주소를 연결할 수 있습니다.

---

## 새 시즌이 나왔을 때

1. `catalogs` 폴더에 새 PDF를 넣고 `start.bat` 실행
2. 관리자에서 제목·주소 정하고 **Publish**
3. Embed 탭에서 **Prepare download** → **Download .zip**
4. Cloudflare에서 새 프로젝트를 만들고 zip을 끌어다 놓기

시즌마다 주소를 따로 두시는 게 좋습니다 (`puppia-2026fw`, `puppia-2027ss`).
예전 링크를 받은 바이어가 나중에 열어도 그대로 보입니다.

같은 시즌을 고쳤을 때는 같은 프로젝트에서 **Create deployment** 으로 새 zip을 올리면
주소는 그대로 두고 내용만 바뀝니다.

## 안 될 때

| 증상 | 해결 |
| --- | --- |
| Embed 탭에 **Publish without a server** 칸이 없음 | 예전 버전입니다. 최신 파일을 다시 받으세요 |
| **Prepare download** 눌러도 반응 없음 | 검은 창이 꺼진 상태입니다. `start.bat` 을 다시 실행하세요 |
| Cloudflare가 zip을 안 받아줌 | 압축을 푼 폴더를 통째로 끌어다 놓아도 동일하게 동작합니다 |
| 주소는 나왔는데 화면이 하얗게 나옴 | 1~2분 기다렸다 새로고침하세요 |
| **ERR_QUIC_PROTOCOL_ERROR** / 사이트에 연결할 수 없습니다 | 업로드는 대개 정상입니다. 회사 방화벽이 QUIC(UDP 443)을 막아서 생기는 네트워크 문제입니다. ① 휴대폰에서 **와이파이를 끄고** 같은 주소를 열어보세요 ② PC는 `chrome://flags` → `quic` 검색 → **Experimental QUIC protocol** 을 **Disabled** 로 바꾸고 재시작 ③ 엣지나 시크릿 창에서도 확인 |
| 주소가 `wandering-sea-a5b3` 처럼 이상함 | 이름을 안 넣고 넘어간 경우입니다. 지우고 이름을 넣어 다시 만드세요 |
| 페이지 일부가 안 보임 | 업로드가 끊긴 경우입니다. 같은 zip을 다시 올리세요 |

## 참고 — 카페24는 왜 안 쓰나

| 상품 | 설명 |
| --- | --- |
| 이미지 호스팅 (구독 중) | 이미지 전용이라 뷰어를 올려도 웹페이지로 열리지 않습니다 |
| 쇼핑몰 웹FTP | `/web/upload/` 에 올려 서비스 가능. 파일이 200개가 넘어 FileZilla가 필요합니다 |
| Cloudflare Pages | zip 하나만 끌어다 놓으면 되고, 트래픽 요금이 없습니다 |

카페24 쇼핑몰 경로가 필요하시면 [CAFE24-ko.md](CAFE24-ko.md) 를 보세요.
