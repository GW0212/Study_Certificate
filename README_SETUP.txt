[완전 안정화 CMS 설정 방법]

1. GitHub 저장소에 아래 파일 업로드
- index.html
- script.js
- styles.css
- favicon.png
- site-data.json

2. GitHub Pages 활성화
- Settings > Pages
- Branch: main
- Folder: /(root)

3. GitHub 토큰 생성
- GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens
- Repository access: 사용할 저장소 선택
- Repository permissions: Contents -> Read and write

4. 사이트 관리자 모드에서 입력
- Owner: GitHub 아이디
- Repository: 저장소 이름
- Branch: main
- Token: 방금 만든 토큰
- [저장 시 GitHub 자동 반영 사용] 체크
- [연동 정보 저장] 클릭

5. 안정화 버전 변경점
- 저장 직전 최신 site-data.json SHA 재조회
- 409 충돌 발생 시 최대 3회 자동 재시도
- 동일 내용이면 불필요한 커밋 생략
- 마지막 반영 시각 저장
- 저장/반영 중 버튼 잠금
- 인증/권한 오류 메시지 한글 안내

6. 주의
- Owner는 GitHub 아이디
- Repository는 저장소 이름
- 사용자 페이지 저장소 예시
  Owner: gw0212
  Repository: gw0212.github.io

7. 반영 확인
- GitHub 저장소의 site-data.json 시간이 갱신되면 정상
- GitHub Pages는 보통 수 초~수 분 뒤 반영
- 안 보이면 Ctrl+F5 새로고침
