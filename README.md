# 복지인사이트 전문교육 홈페이지

> 현장의 경험에 AI를 더하다 — AI를 배우는 교육을 넘어, 사회복지 현장에서 사용하는 교육

빌드 도구 없이 바로 열리는 정적 웹사이트입니다. 3D 로고는 인터넷 연결(Three.js CDN)이 있을 때 표시되며, 없으면 같은 모양의 정지 이미지가 보입니다. `index.html`을 브라우저로 열거나
GitHub Pages·Netlify 등에 그대로 올리면 됩니다.

## 구성

| 파일 | 내용 |
| --- | --- |
| `index.html` | 페이지 구조 (HERO → CTA → WHY → 전문교육 → 맞춤교육 → 실습 → AI 도구 → 강사 → 교육현장 → 후기 → 강의자료 → 절차 → FAQ → 문의) |
| `css/style.css` | 디자인 (로고 색상 기반 올리브 블랙·크림 + 앰버 CTA, 반응형, 인쇄용 스타일) |
| `js/data.js` | **콘텐츠 데이터** — 20개 교육과정, 맞춤교육 규칙, 교육현장, 후기, FAQ, 연락처 |
| `js/main.js` | 탭·검색, 과정 상세 팝업, 2027 강의계획서(인쇄/PDF), 맞춤교육 미리보기, 문의폼 |
| `js/logo3d.js`, `js/logo-path.js` | 히어로 3D 로고 (Three.js, 로고 벡터를 입체로 돌출·광택 렌더링, 마우스에 반응) |
| `assets/img/logo.png` | 복지인사이트 로고 원본 |
| `assets/img/logo-mark.svg` | 로고 벡터 (투명 배경) |
| `assets/img/logo-3d.png` | 3D 로고 정지 이미지 (WebGL을 쓸 수 없을 때 대체 이미지, 강사 소개 영역) |

## 내용 수정 방법

- **교육과정 내용**: `js/data.js`의 `COURSES` 배열에서 교육대상·시간·주요내용·실습·결과물을 수정합니다.
- **교육현장 사진**: 사진을 `assets/img/field/`에 넣고 `PORTFOLIO` 항목의 `image` 값에 경로를 적습니다.
- **강사 사진**: `assets/img/instructor.jpg`를 넣고 `index.html`의 강사 소개 영역 주석을 해제합니다.
- **교육 후기**: `REVIEWS`는 예시 문구입니다. 실제 후기 원문으로 교체해 주세요.

## 문의폼 동작 (교육신청)

1. `js/data.js`의 `formEndpoint`에 Apps Script 웹앱 주소가 있으면 → **구글 시트 저장 + 담당자 문자 알림**
   설정 방법: [`apps-script/README.md`](apps-script/README.md)
2. 주소가 비어 있거나 시트 전송이 실패하면 → [FormSubmit](https://formsubmit.co)으로 `CONTACT.email` 메일함에 **바로 전송**
   - 처음 한 번은 FormSubmit이 보내는 "Activate Form" 인증 메일의 버튼을 눌러야 이후 메일이 들어옵니다.
3. 둘 다 실패하면 "메일 앱으로 보내기" 버튼과 전화번호를 안내합니다.
