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

## 출처

* 파일 25 MB 한계, 배포 횟수 — [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
* 토큰 권한 — [Use Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
