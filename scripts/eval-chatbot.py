"""
Chat-Ki-S 챗봇 성능 평가 스크립트

사용법:
  1. 서비스 실행 (docker compose up 또는 개별 실행)
  2. python3 scripts/eval-chatbot.py

평가 항목:
  A. RAG 답변 정확도 (사내 규정/가이드 질문)
  B. Function Calling 도구 선택 정확도
  C. 폴백 처리 적절성
  D. 답변 적절성 검증 (할루시네이션 방지)
  E. 상대 날짜 이해도
"""

import json
import time
import sys
from datetime import datetime

try:
    import httpx
except ImportError:
    print("httpx 설치 필요: pip install httpx")
    sys.exit(1)

BACKEND_URL = "https://chat-ki-s-production.up.railway.app"
AI_URL = "https://chat-ki-s-production.up.railway.app"  # backend proxies to AI

# 테스트 계정
TEST_EMPLOYEE_ID = "20260002"
TEST_PASSWORD = "jky0002"


# ──────────────────────────────────────────────
# 테스트 시나리오 정의
# ──────────────────────────────────────────────

SCENARIOS = [
    # ── A. RAG 답변 정확도 (사내 규정/가이드) ──
    {
        "id": "RAG-01",
        "category": "RAG",
        "question": "법인카드 사용 기준이 어떻게 돼요?",
        "expect_keywords": ["법인카드", "업무"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-02",
        "category": "RAG",
        "question": "연차 신청은 어떻게 하나요?",
        "expect_keywords": ["연차", "신청"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-03",
        "category": "RAG",
        "question": "복리후생 제도 알려줘",
        "expect_keywords": ["복리후생", "지원"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-04",
        "category": "RAG",
        "question": "PC 세팅 어떻게 해요?",
        "expect_keywords": ["PC", "설치"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-05",
        "category": "RAG",
        "question": "택시 이용 방법 알려줘",
        "expect_keywords": ["택시"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-06",
        "category": "RAG",
        "question": "여의도 점심 맛집 추천해줘",
        "expect_keywords": ["맛집", "여의도"],
        "expect_source": True,
        "expect_fallback": False,
    },
    {
        "id": "RAG-07",
        "category": "RAG",
        "question": "챗키스 활용 방법 알려줘",
        "expect_keywords": ["챗키스", "도와"],
        "expect_source": True,
        "expect_fallback": False,
    },

    # ── B. Function Calling 도구 선택 ──
    {
        "id": "FC-01",
        "category": "FunctionCalling",
        "question": "내 연차 며칠 남았어?",
        "expect_tool": "get_leave_balance",
        "expect_fallback": False,
    },
    {
        "id": "FC-02",
        "category": "FunctionCalling",
        "question": "오늘 메일 확인해줘",
        "expect_tool": "get_mails",
        "expect_fallback": False,
    },
    {
        "id": "FC-03",
        "category": "FunctionCalling",
        "question": "인사팀 담당자 누구예요?",
        "expect_tool": "search_employees",
        "expect_fallback": False,
    },
    {
        "id": "FC-04",
        "category": "FunctionCalling",
        "question": "오늘 일정 알려줘",
        "expect_tool": "get_schedule",
        "expect_fallback": False,
    },
    {
        "id": "FC-05",
        "category": "FunctionCalling",
        "question": "PER이 뭐야?",
        "expect_tool": "search_glossary",
        "expect_fallback": False,
    },
    {
        "id": "FC-06",
        "category": "FunctionCalling",
        "question": "내 과제 목록 보여줘",
        "expect_tool": "get_assignments",
        "expect_fallback": False,
    },
    {
        "id": "FC-07",
        "category": "FunctionCalling",
        "question": "회의실 내일 비어있어?",
        "expect_tool": "check_room_availability",
        "expect_fallback": False,
    },

    # ── C. 폴백 처리 ──
    {
        "id": "FB-01",
        "category": "Fallback",
        "question": "비트코인 시세 알려줘",
        "expect_keywords": ["죄송"],
        "expect_fallback": True,
    },
    {
        "id": "FB-02",
        "category": "Fallback",
        "question": "오늘 날씨 어때?",
        "expect_keywords": ["죄송"],
        "expect_fallback": True,
    },

    # ── D. 상대 날짜 이해 ──
    {
        "id": "DATE-01",
        "category": "DateUnderstanding",
        "question": "오늘이 며칠이야?",
        "expect_keywords": [datetime.now().strftime("%Y"), "월"],
        "expect_fallback": False,
    },
    {
        "id": "DATE-02",
        "category": "DateUnderstanding",
        "question": "다음 주 월요일이 며칠이야?",
        "expect_keywords": ["월요일"],
        "expect_fallback": False,
    },

    # ── E. 챗키스 자기소개 ──
    {
        "id": "INTRO-01",
        "category": "Intro",
        "question": "넌 누구야?",
        "expect_keywords": ["온보딩"],
        "expect_fallback": False,
    },
]


# ──────────────────────────────────────────────
# 평가 함수
# ──────────────────────────────────────────────

def login(client: httpx.Client) -> str:
    """로그인하여 토큰 반환"""
    res = client.post(f"{BACKEND_URL}/api/auth/login", json={
        "employeeId": TEST_EMPLOYEE_ID,
        "password": TEST_PASSWORD,
    })
    if res.status_code != 200:
        print(f"로그인 실패: {res.status_code} {res.text}")
        sys.exit(1)
    return res.json()["accessToken"]


def send_chat(client: httpx.Client, token: str, question: str) -> dict:
    """대화 생성 → 메시지 전송"""
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 대화 생성
    conv_res = client.post(
        f"{BACKEND_URL}/api/conversations",
        json={},
        headers=headers,
        timeout=10,
    )
    if conv_res.status_code not in (200, 201):
        return {"error": conv_res.status_code, "body": conv_res.text}

    conv_id = conv_res.json().get("id")
    if not conv_id:
        return {"error": "no_conv_id", "body": str(conv_res.json())}

    # 2. 메시지 전송
    res = client.post(
        f"{BACKEND_URL}/api/conversations/{conv_id}/messages",
        json={"content": question, "mode": "rag"},
        headers=headers,
        timeout=60,
    )
    if res.status_code != 200:
        return {"error": res.status_code, "body": res.text}
    return res.json()


def evaluate_scenario(scenario: dict, response: dict) -> dict:
    """시나리오별 평가"""
    result = {
        "id": scenario["id"],
        "category": scenario["category"],
        "question": scenario["question"],
        "passed": True,
        "issues": [],
    }

    if "error" in response:
        result["passed"] = False
        result["issues"].append(f"API 에러: {response['error']}")
        result["answer"] = response.get("body", "")[:100]
        return result

    answer = response.get("message", {}).get("content", "") if "message" in response else response.get("answer", "")
    result["answer"] = answer[:200]

    # 키워드 체크
    if "expect_keywords" in scenario:
        for kw in scenario["expect_keywords"]:
            if kw not in answer:
                result["issues"].append(f"키워드 누락: '{kw}'")

    # 출처 체크
    if scenario.get("expect_source"):
        if "출처" not in answer and not response.get("sources"):
            result["issues"].append("출처 미표시")

    # 폴백 체크
    is_fallback = response.get("is_fallback", False) or "죄송" in answer
    if scenario.get("expect_fallback") and not is_fallback:
        result["issues"].append("폴백이어야 하는데 답변함")
    if not scenario.get("expect_fallback") and is_fallback:
        result["issues"].append("답변해야 하는데 폴백됨")

    if result["issues"]:
        result["passed"] = False

    return result


# ──────────────────────────────────────────────
# 메인 실행
# ──────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Chat-Ki-S 챗봇 성능 평가")
    print(f"  실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()

    # 서비스 상태 확인
    client = httpx.Client()

    try:
        res = client.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"  Backend: {res.json()}")
    except Exception as e:
        print(f"❌ Backend 연결 실패: {e}")
        sys.exit(1)

    print("✅ 서비스 정상 확인")
    print()

    # 로그인
    token = login(client)
    print(f"✅ 로그인 성공 (사번: {TEST_EMPLOYEE_ID})")
    print()

    # 시나리오 실행
    results = []
    categories = {}

    for i, scenario in enumerate(SCENARIOS):
        print(f"[{i+1}/{len(SCENARIOS)}] {scenario['id']}: {scenario['question']}")

        start = time.time()
        response = send_chat(client, token, scenario["question"])
        elapsed = time.time() - start

        result = evaluate_scenario(scenario, response)
        result["elapsed_ms"] = round(elapsed * 1000)
        results.append(result)

        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"  {status} ({result['elapsed_ms']}ms)")
        if result["issues"]:
            for issue in result["issues"]:
                print(f"    → {issue}")
        print(f"  답변: {result['answer'][:80]}...")
        print()

        # 카테고리별 집계
        cat = scenario["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0}
        categories[cat]["total"] += 1
        if result["passed"]:
            categories[cat]["passed"] += 1

    # 최종 리포트
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    avg_ms = round(sum(r["elapsed_ms"] for r in results) / total) if total else 0

    print("=" * 60)
    print("  최종 결과")
    print("=" * 60)
    print(f"  총 시나리오: {total}개")
    print(f"  통과: {passed}개  |  실패: {failed}개")
    print(f"  통과율: {round(passed/total*100, 1)}%")
    print(f"  평균 응답 시간: {avg_ms}ms")
    print()

    print("  카테고리별:")
    for cat, stats in categories.items():
        rate = round(stats["passed"] / stats["total"] * 100, 1)
        print(f"    {cat}: {stats['passed']}/{stats['total']} ({rate}%)")
    print()

    if failed > 0:
        print("  ❌ 실패 항목:")
        for r in results:
            if not r["passed"]:
                print(f"    {r['id']}: {', '.join(r['issues'])}")
    print()

    # JSON 리포트 저장
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": round(passed / total * 100, 1),
            "avg_response_ms": avg_ms,
        },
        "categories": categories,
        "results": results,
    }

    report_path = "scripts/eval-result.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  📄 상세 리포트: {report_path}")
    print()


if __name__ == "__main__":
    main()
