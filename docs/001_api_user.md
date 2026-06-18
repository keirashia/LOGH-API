# 유저 API / DB 설계
> 분류: 백엔드
> 경로: `LOGH-API/docs/001_api_user.md`
> 최종 수정: 2026-06-18

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `src/controllers/userController.js` | 유저 라우터 핸들러 |
| `src/models/userModel.js` | SQLite3 쿼리 |
| `db/logh.db` | SQLite3 데이터베이스 |

프론트 연동 설계: `LOGH-WEB/docs/111_data_auth.md`

---

## 4-1. 기존 구현 확인 — `/user/isRegisted` ≒ findByTempCode

```
POST /user/isRegisted  { uuid }
  → TBL_USER_MAIN에서 UUID로 조회
    있으면: 해당 row 반환
    없으면: userId = uuid 앞 8자리, userPwd = uuid 전체로 자동 계정 생성 → 로그인 → 반환
```

프론트에서 별도 `findByTempCode` 신규 엔드포인트 없이 이 엔드포인트를 호출하면 됨.  
단, 아래 4-2~4-5 수정 후 연결 권장.

---

## 4-2. 스키마 수정 — UUID 컬럼 타입

**문제**: `TBL_USER_MAIN.UUID`가 `INTEGER NOT NULL`로 선언되어 있으나,  
실제 값은 64자리 hex 또는 UUID v4(하이픈 포함 36자) 문자열.  
현재 운영 DB에 두 형식이 혼재되어 저장됨 (과거 테스트 데이터로 추정).

**수정**: `TEXT`로 스키마 수정, 기존 데이터 보존하며 마이그레이션.

---

## 4-3. `isRegisted` 자동 계정 생성 — userId 충돌 위험

**문제**: 신규 uuid 발견 시 `userId = uuid.substring(0, 8)`로 자동 생성.  
- uuid 앞 8자리만 사용하면 다른 유저끼리 충돌 가능성 있음
- `USER_ID`에 UNIQUE 제약이 없어 당장 에러는 안 나지만 USER_ID 중복 발생 가능

**수정 후보**:
- `GUEST_` + 자동증가 ID
- uuid 앞 8자리 + 중복 시 재시도 로직

---

## 4-4. `/user/createUser` 응답 처리 누락

```js
// 현재 코드
router.post('/createUser', (req, res) => {
  const { uuid } = req.body;
  userModel.createUser(uuid, (err, user) => {
    if (err) { ... }
    else {
      // ← 비어있음, 성공해도 응답 안 보냄
    }
  });
});
```

추가 문제: `createUser` 모델 함수는 `(userId, userPwd, uuid, callback)` 3개 인자를 받는데  
컨트롤러는 `uuid` 하나만 넘기고 있어 인자 불일치.

**수정**: 성공 시 응답 처리 추가 + 인자 불일치 수정. (실사용 여부 먼저 확인)

---

## 4-5. `isRegisted` 응답의 `result` 필드 항상 'Y' 고정

```js
// 현재 코드
const result = 'Y';  // 신규 생성/기존 조회 구분 없이 항상 'Y'
res.status(200).json({ result, user });
```

프론트에서 "신규 게스트인지 기존 계정인지" 구분이 필요할 경우,  
model 쪽에서 신규/기존 여부를 함께 반환하도록 수정.

**수정안**:
```js
// 기존 조회: result: 'EXISTING'
// 신규 생성: result: 'NEW'
```

---

## 4-6. 신규 테이블 추가 — 유저 데이터 모델 반영

`TBL_USER_MAIN`에 이미 존재하는 컬럼: `POINT`(3-1), `LANG_TYPE`(3-3) → 추가 작업 불필요.  
아래 항목은 1:N 관계라 별도 테이블 필요:

```sql
-- 유저별 시나리오 잠금 해제
CREATE TABLE TBL_USER_SCENARIO (
  ID           INTEGER PRIMARY KEY AUTOINCREMENT,
  USER_ID      INTEGER NOT NULL,
  SCENARIO_ID  TEXT    NOT NULL,        -- scenario.js의 id (예: 'SE796_1')
  UNLOCK_TYPE  TEXT    NOT NULL,        -- 'FREE' | 'POINT_PURCHASE' | 'EVENT'
  UNLOCKED_AT  DATE    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(USER_ID, SCENARIO_ID)
);

-- 유저별 캐릭터 잠금 해제 (시나리오 내부)
CREATE TABLE TBL_USER_CHARACTER (
  ID           INTEGER PRIMARY KEY AUTOINCREMENT,
  USER_ID      INTEGER NOT NULL,
  CHAR_CODE    TEXT    NOT NULL,        -- 예: CH_000064
  UNLOCK_TYPE  TEXT    NOT NULL,
  UNLOCKED_AT  DATE    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(USER_ID, CHAR_CODE)
);

-- 업적 마스터 (정의 목록)
CREATE TABLE TBL_ACHIEVEMENT_MASTER (
  ID             TEXT PRIMARY KEY,      -- 예: 'ACH_001'
  NAME_KR        TEXT,
  NAME_EN        TEXT,
  NAME_JP        TEXT,
  DESC_KR        TEXT,
  DESC_EN        TEXT,
  DESC_JP        TEXT,
  CONDITION_TYPE TEXT                   -- 추후 구체화
);

-- 유저별 업적 달성 기록
CREATE TABLE TBL_USER_ACHIEVEMENT (
  ID             INTEGER PRIMARY KEY AUTOINCREMENT,
  USER_ID        INTEGER NOT NULL,
  ACHIEVEMENT_ID TEXT    NOT NULL,      -- FK → TBL_ACHIEVEMENT_MASTER.ID
  ACHIEVED_AT    DATE    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(USER_ID, ACHIEVEMENT_ID)
);
```

---

## 4-7. 기존 테스트 데이터 정리

현재 `TBL_USER_MAIN`에 5건 존재.  
이 중 2건은 `isRegisted` 자동생성 로직으로 생긴 테스트성 데이터로 추정 (`USER_ID`가 uuid 앞 8자리 그대로).  
운영 전이므로 4-1~4-6 적용 후 데이터 초기화 또는 마이그레이션 스크립트로 정합성 맞출지 결정.

---

## TODO

- [ ] `TBL_USER_MAIN.UUID` 컬럼 타입 `INTEGER → TEXT` 마이그레이션 (4-2)
- [ ] `isRegisted` 자동 계정 생성 시 userId 충돌 안전한 방식으로 변경 (4-3)
- [ ] `/user/createUser` 성공 응답 추가 + 인자 불일치 수정 (4-4)
- [ ] `isRegisted` 응답 `result` 필드 'NEW'/'EXISTING' 구분 반환 (4-5)
- [ ] `TBL_USER_SCENARIO`, `TBL_USER_CHARACTER`, `TBL_ACHIEVEMENT_MASTER`, `TBL_USER_ACHIEVEMENT` 테이블 생성 (4-6)
- [ ] `TBL_USER_MAIN` 기존 테스트 데이터 초기화 여부 결정 (4-7)
- [ ] 위 수정 완료 후 프론트 `authStore.findByTempCode()` 연결 (`LOGH-WEB/docs/111_data_auth.md` 참조)
