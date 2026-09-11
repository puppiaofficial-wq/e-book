# 배포를 버튼 하나로

> 관리자 화면의 **Publish to Cloudflare** 버튼으로 zip 다운로드 없이 바로 배포합니다.
> 처음 한 번만 계정을 연결하면 됩니다. 요금은 들지 않습니다.

## 무엇이 달라지나

| | 지금까지 | 연결 후 |
| --- | --- | --- |
| 1 | start.bat 실행 | (자동 시작 등록 시 불필요) |
| 2 | 관리자 화면 접속 | 즐겨찾기 클릭 |
| 3 | PDF 업로드·변환 | 그대로 |
| 4 | Prepare download → zip 다운로드 | Prepare download |
| 5 | 클라우드플레어 접속 → 드래그 → 배포 | **Publish to Cloudflare** 클릭 |

## 1단계 — 계정 ID 복사

1. <https://dash.cloudflare.com> 에 로그인합니다
2. 왼쪽에서 **Workers & Pages** 를 누릅니다
3. 오른쪽 칸에 **Account ID** 가 있습니다. 32자리 영문·숫자입니다. 복사합니다

## 2단계 — API 토큰 만들기

토큰은 "이 프로그램이 내 클라우드플레어에 파일을 올려도 된다"는 열쇠입니다.
꼭 필요한 권한 하나만 주는 것이 안전합니다.

1. <https://dash.cloudflare.com/profile/api-tokens> 로 갑니다
2. **Create Token** → 맨 아래 **Custom token** 의 **Get started**
3. 이름은 아무거나 (예: `eBook Studio`)
4. **Permissions** 에서 세 칸을 이렇게 고릅니다

   | 칸 | 고를 값 |
   | --- | --- |
   | 첫째 | **Account** |
   | 둘째 | **Cloudflare Pages** |
   | 셋째 | **Edit** |

5. **Continue to summary** → **Create Token**
6. 화면에 딱 한 번만 보이는 긴 문자열을 복사합니다. 창을 닫으면 다시 볼 수 없습니다

## 3단계 — 연결

1. 관리자 화면 왼쪽 **Settings**
2. **Cloudflare Pages** 카드에 Account ID 와 토큰을 붙여 넣습니다
3. **Save and test** 를 누릅니다. 초록색으로 *Connected* 이 나오면 끝입니다

토큰은 내 컴퓨터의 `data/library.json` 에만 저장되고, 화면으로 다시 나오지 않습니다.
다른 사람에게 넘어갈 일이 없습니다.

## 4단계 — 배포

카탈로그를 열고 **Embed on your site** 탭에서

1. **Prepare download** — 배포용 파일을 만듭니다
2. **Publish to Cloudflare** — 바로 올라갑니다
3. 끝나면 주소가 나옵니다. `https://카탈로그이름.pages.dev`

같은 카탈로그를 다시 배포하면 바뀐 파일만 올라가서 몇 초면 끝납니다.
프로젝트는 처음 배포할 때 자동으로 만들어집니다. 클라우드플레어 화면에 들어갈 일이 없습니다.

## 알아 두면 좋은 것

* **파일 하나당 25 MB** 가 클라우드플레어의 한계입니다. 인쇄용 PDF 원본은 보통 이보다
  크기 때문에, PDF 다운로드를 켜 두었더라도 배포본에서는 자동으로 빠지고 안내가 나옵니다.
  카탈로그 보기 자체에는 영향이 없습니다
* 무료 요금제에서 **한 달 500번** 배포할 수 있습니다. 시즌마다 올리는 용도로는 남습니다
* 트래픽은 무제한입니다
* 계정을 연결하지 않은 상태에서 버튼을 누르면 클라우드플레어 업로드 화면이 새 창으로
  열립니다. zip 을 받아 그대로 끌어다 놓으면 됩니다

## 자주 나오는 오류

| 메시지 | 뜻과 해결 |
| --- | --- |
| *Authentication error (10000)* | 토큰 권한이 모자랍니다. 2단계의 세 칸을 다시 확인하세요 |
| *the API token was rejected* | 토큰을 잘못 붙여 넣었습니다. 새로 만들어 다시 넣으세요 |
| *Prepare the download first* | **Prepare download** 를 먼저 누르세요 |
| *files up to 25 MB* | 25 MB 가 넘는 파일이 들어 있습니다. 메시지에 파일 이름이 나옵니다 |

## 홈페이지(아임웹 등)에 끼워 넣기

배포가 끝난 카탈로그는 홈페이지 안에 그대로 넣을 수 있습니다.

### 붙여 넣을 코드

관리자 화면 → 카탈로그 → **Embed on your site** → *Embed in a web page* 의 코드를
복사해 홈페이지의 **코드 위젯**에 붙여 넣습니다. 이런 모양입니다.

```html
<iframe src="https://26fw-puppia.pages.dev/?embed=1" title="26FW PUPPIA"
        style="width:100%;aspect-ratio:16/10;border:0" allowfullscreen loading="lazy"></iframe>
```

### 아임웹에서

1. 편집 화면에서 **코드** 위젯을 페이지에 올립니다
2. **코드 에디터 열기**
3. 위 코드를 붙여 넣고 **저장**
4. **게시하기**

아임웹 무료 버전은 `<script>` 를 지우고 저장하지만, `<iframe>` 은 스크립트가 아니라서
그대로 남습니다.

### 반드시 지켜야 할 것

| | 맞음 | 틀림 |
| --- | --- | --- |
| 주소 | `https://26fw-puppia.pages.dev/` | `http://localhost:8080/...` |
| 프로토콜 | `https` | `http` |

`localhost` 는 "이 컴퓨터"라는 뜻입니다. 방문자의 브라우저가 그 주소를 열면
**방문자 자신의 컴퓨터**를 찾아가기 때문에 아무것도 나오지 않습니다.

그리고 홈페이지가 `https` 인데 `http` 주소를 끼워 넣으면, 브라우저가 안전하지 않다고
보고 아예 막아 버립니다. 화면이 비어 보이는 대부분의 원인이 이것입니다.

관리자 화면은 배포 전에는 `localhost` 주소를 노란 경고와 함께 보여 주고,
배포한 뒤에는 `pages.dev` 주소로 바뀝니다. 경고가 보이면 아직 배포 전입니다.

### PC용과 모바일용을 따로 넣으세요

아임웹은 PC 화면과 모바일 화면을 따로 편집합니다. 두 코드가 다릅니다.

PC는 두 장이 펼쳐진 모양이라 가로로 긴 틀이 맞습니다.

```html
<iframe src="https://26fw-puppia.pages.dev/?embed=1" title="26FW PUPPIA"
        style="width:100%;aspect-ratio:16/10;border:0" allowfullscreen loading="lazy"></iframe>
```

휴대폰은 한 장씩 보이므로 세로로 긴 틀이라야 페이지가 화면 가로를 꽉 채웁니다.
가로로 긴 틀을 그대로 쓰면 위아래 검은 여백만 넓고 페이지는 손톱만 하게 나옵니다.

```html
<iframe src="https://26fw-puppia.pages.dev/?embed=1" title="26FW PUPPIA"
        style="width:100%;aspect-ratio:390/640;border:0" allowfullscreen loading="lazy"></iframe>
```

두 코드 모두 관리자 화면 **Embed on your site** 의 *Desktop* / *Mobile* 칸에
카탈로그에 맞게 계산되어 나옵니다. 그대로 복사해 쓰시면 됩니다.

### 비율 숫자의 뜻

`aspect-ratio:390/640` 은 "가로 390일 때 세로 640" 이라는 뜻입니다.
카탈로그 판형에 따라 뒷숫자가 달라집니다.

| 카탈로그 판형 | 모바일 비율 |
| --- | --- |
| A4 (210 x 297) | `390/647` |
| 176 x 246 mm | `390/640` |
| A5 (148 x 210) | `390/648` |
| 정사각형 | `390/490` |
| 가로형 (297 x 210) | `390/379` |

여백이 남으면 뒷숫자를 조금 줄이고, 페이지 위아래가 잘리면 조금 늘리세요.
고정 높이로 하고 싶으면 이렇게 바꿉니다.

```html
style="width:100%;height:720px;border:0"
```

### 카탈로그 내용을 바꿨을 때

한 번 배포한 카탈로그는 버튼이 **Update on Cloudflare** 로 바뀝니다.
PDF를 새로 올렸거나 목차·링크를 고쳤다면 이 버튼 하나만 누르면 됩니다.
배포용 파일을 다시 만드는 것부터 업로드까지 한 번에 처리합니다.

주소는 그대로입니다. 홈페이지에 넣어 둔 코드도 손댈 필요가 없습니다.
바뀐 파일만 올라가므로 보통 몇 초면 끝납니다.

### 배포한 적이 있는지 확인하기

다른 카탈로그를 보다가 돌아와도 상태가 그대로 남아 있습니다.

| 화면 | 뜻 |
| --- | --- |
| **Prepare download** 만 있음 | 아직 배포용 파일을 만들지 않았습니다 |
| **Publish to Cloudflare** 가 보임 | 파일은 준비됐고, 아직 올리지 않았습니다 |
| **Update on Cloudflare** + 주소 | 이미 배포되어 있습니다 |

QR 코드도 배포한 뒤에만 나옵니다. 배포 전에는 내 컴퓨터 주소밖에 없어서
찍어도 다른 사람은 열 수 없기 때문입니다.

## 출처

* 파일 25 MB 한계, 배포 횟수 — [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
* 토큰 권한 — [Use Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
