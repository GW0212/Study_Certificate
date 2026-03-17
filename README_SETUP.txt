GitHub 자동 반영 설정 방법

1. 이 ZIP 내용을 저장소 루트에 업로드합니다.
2. GitHub Pages가 이 저장소 루트를 배포하도록 설정합니다.
3. 관리자 모드에서 GitHub 자동 반영 설정 입력
   - Owner: GitHub 사용자명 또는 조직명
   - Repository: 저장소 이름
   - Branch: 보통 main
   - GitHub Token: Contents Read and Write 권한 필요
4. 연동 정보 저장 후 "저장 시 GitHub 자동 반영 사용" 체크
5. 내용 수정 후 저장하면 site-data.json 이 자동 커밋됩니다.

주의
- 토큰은 브라우저 localStorage 에 저장됩니다. 공용 PC 에서는 사용하지 마세요.
- Pages 반영은 수 초~수 분 지연될 수 있습니다.
- GitHub Pages가 다른 브랜치/폴더를 보고 있으면 반영되지 않습니다.
