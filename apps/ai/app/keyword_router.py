"""
키워드 기반 문서 라우팅 모듈

사용자 질문에서 키워드를 추출하고, 미리 정의된 카테고리에 매핑하여
해당 문서만 LLM 컨텍스트로 전달합니다.

Flow: 사용자 질문 → 키워드 추출 → 카테고리 매핑 → 문서 로드 → LLM 전달
"""

import re
from pathlib import Path
from dataclasses import dataclass, field

# 로컬: apps/ai/../../data/seed = 프로젝트루트/data/seed
# Docker: /app/data/seed (docker-compose volume)
_LOCAL_SEED = Path(__file__).resolve().parent.parent.parent.parent / "data" / "seed"
_DOCKER_SEED = Path("/app/data/seed")
SEED_DIR = _LOCAL_SEED if _LOCAL_SEED.exists() else _DOCKER_SEED


@dataclass
class RouteResult:
    category: str
    matched_keywords: list[str]
    doc_content: str
    doc_source: str


# ──────────────────────────────────────────────
# 카테고리별 문서 매핑
# ──────────────────────────────────────────────
CATEGORY_DOCS: dict[str, list[str]] = {
    # 정책/가이드 문서
    "vacation": ["연차_유급휴가_사용_및_신청_가이드.md"],
    "benefits": ["키움증권_임직원_복리후생_제도.md"],
    "guide_card": ["법인카드_사용_및_경비_정산_가이드라인.md"],
    "guide_taxi": ["키움증권_업무용_택시_서비스_이용_매뉴얼.md"],
    "guide_vehicle": ["법인차량_사용_및_관리_지침서.md"],
    "guide_pc": ["신입사원_업무용_PC_프로그램_설치_및_세팅_가이드.md"],
    "guide_it": ["신입사원_IT_시스템_및_인프라_권한_신청_가이드.md"],
    # 부문별 실무지침서
    "dept_ict": ["dept_ICT부문.md"],
    "dept_stm": ["dept_S_T Market부문.md"],
    "dept_sts": ["dept_S_T Solution부문.md"],
    "dept_audit": ["dept_감사부문.md"],
    "dept_sf": ["dept_구조화금융부문.md"],
    "dept_fgm": ["dept_금융그룹관리부문.md"],
    "dept_cf": ["dept_기업금융부문.md"],
    "dept_research": ["dept_리서치센터.md"],
    "dept_risk": ["dept_리스크관리부문.md"],
    "dept_retail": ["dept_리테일플랫폼부문.md"],
    "dept_consumer": ["dept_소비자보호본부.md"],
    "dept_am": ["dept_자산관리부문.md"],
    "dept_finance": ["dept_재무지원부문.md"],
    "dept_strategy": ["dept_전략기획부문.md"],
    "dept_compliance": ["dept_준법지원부문.md"],
    "dept_comm": ["dept_커뮤니케이션본부.md"],
    "dept_invest": ["dept_투자운용부문.md"],
    "dept_project": ["dept_프로젝트투자부문.md"],
}

# ──────────────────────────────────────────────
# 키워드 → 카테고리 매핑 테이블
# ──────────────────────────────────────────────
KEYWORD_MAP: dict[str, str] = {
    # === 휴가/연차 ===
    "연차": "vacation",
    "휴가": "vacation",
    "반차": "vacation",
    "병가": "vacation",
    "경조사": "vacation",
    "출산휴가": "vacation",
    "육아휴직": "vacation",
    "배우자출산": "vacation",
    "결혼휴가": "vacation",
    "무급휴직": "vacation",
    "대체휴일": "vacation",
    "쉬는 날": "vacation",
    "개근": "vacation",
    "출근율": "vacation",

    # === 복리후생 ===
    "복리후생": "benefits",
    "복지": "benefits",
    "건강검진": "benefits",
    "의료비": "benefits",
    "명절": "benefits",
    "선물": "benefits",
    "경조금": "benefits",
    "축의금": "benefits",
    "부의금": "benefits",
    "헬스장": "benefits",
    "피트니스": "benefits",
    "어린이집": "benefits",
    "보육": "benefits",
    "동호회": "benefits",
    "퇴직연금": "benefits",
    "퇴직금": "benefits",
    "4대보험": "benefits",
    "자기개발": "benefits",
    "교육비": "benefits",
    "학자금": "benefits",
    "대출": "benefits",
    "융자": "benefits",
    "주택자금": "benefits",
    "주거": "benefits",
    "주택": "benefits",
    "생활안정자금": "benefits",
    "보험": "benefits",
    "수당": "benefits",
    "성과급": "benefits",
    "인센티브": "benefits",
    "급여": "benefits",
    "연봉": "benefits",
    "월급": "benefits",
    "식대": "benefits",
    "교통비": "benefits",
    "통신비": "benefits",

    # === 법인카드/경비 ===
    "법인카드": "guide_card",
    "경비정산": "guide_card",
    "경비": "guide_card",
    "비용처리": "guide_card",
    "영수증": "guide_card",
    "출장비": "guide_card",
    "출장경비": "guide_card",
    "숙박비": "guide_card",
    "개인경비": "guide_card",
    "환급": "guide_card",
    "사용내역": "guide_card",
    "접대비": "guide_card",

    # === 택시 ===
    "택시": "guide_taxi",
    "업무택시": "guide_taxi",
    "택시비": "guide_taxi",
    "카카오T": "guide_taxi",
    "야근택시": "guide_taxi",
    "외근택시": "guide_taxi",

    # === 법인차량 ===
    "법인차량": "guide_vehicle",
    "법인차": "guide_vehicle",
    "차량예약": "guide_vehicle",
    "차량관리": "guide_vehicle",
    "운행기록": "guide_vehicle",

    # === PC 세팅 ===
    "PC설치": "guide_pc",
    "프로그램설치": "guide_pc",
    "HTS": "guide_pc",
    "홈트레이딩": "guide_pc",
    "멀티모니터": "guide_pc",
    "모니터": "guide_pc",
    "세팅": "guide_pc",
    "설치": "guide_pc",
    "소프트웨어": "guide_pc",
    "V3": "guide_pc",
    "백신": "guide_pc",
    "DLP": "guide_pc",
    "DRM": "guide_pc",

    # === IT 인프라/권한 ===
    "권한신청": "guide_it",
    "시스템권한": "guide_it",
    "계정": "guide_it",
    "ERP": "guide_it",
    "그룹웨어": "guide_it",
    "메일": "guide_it",
    "VPN": "guide_it",
    "방화벽": "guide_it",
    "DB접근": "guide_it",
    "IT서비스": "guide_it",
    "서버": "guide_it",
    "인트라넷": "guide_it",

    # === 부문별 ===
    "ICT": "dept_ict",
    "IT기획": "dept_ict",
    "정보보안": "dept_ict",
    "채널기획": "dept_ict",

    "S&T": "dept_stm",
    "FX": "dept_stm",
    "트레이딩": "dept_stm",
    "브로커리지": "dept_stm",

    "구조화": "dept_sts",
    "ELS": "dept_sts",
    "DLS": "dept_sts",
    "파생": "dept_sts",

    "감사": "dept_audit",
    "IT감사": "dept_audit",
    "내부감사": "dept_audit",

    "PF": "dept_sf",
    "부동산": "dept_sf",
    "인프라금융": "dept_sf",

    "금융그룹": "dept_fgm",
    "자회사": "dept_fgm",
    "경영관리": "dept_fgm",

    "기업금융": "dept_cf",
    "IPO": "dept_cf",
    "IB": "dept_cf",
    "M&A": "dept_cf",
    "인수합병": "dept_cf",

    "리서치": "dept_research",
    "애널리스트": "dept_research",
    "산업분석": "dept_research",
    "종목분석": "dept_research",

    "리스크": "dept_risk",
    "리스크관리": "dept_risk",
    "신용리스크": "dept_risk",
    "시장리스크": "dept_risk",

    "리테일": "dept_retail",
    "WM": "dept_retail",
    "자산관리플랫폼": "dept_retail",
    "고객관리": "dept_retail",

    "소비자보호": "dept_consumer",
    "민원": "dept_consumer",
    "VOC": "dept_consumer",

    "자산관리": "dept_am",
    "펀드": "dept_am",
    "투자자문": "dept_am",

    "재무": "dept_finance",
    "총무": "dept_finance",
    "인사": "dept_finance",
    "HR": "dept_finance",
    "급여": "dept_finance",
    "회계": "dept_finance",

    "전략기획": "dept_strategy",
    "경영전략": "dept_strategy",
    "ESG": "dept_strategy",

    "준법감시": "dept_compliance",
    "준법": "dept_compliance",
    "컴플라이언스": "dept_compliance",
    "내부통제": "dept_compliance",
    "자본시장법": "dept_compliance",
    "미공개정보": "dept_compliance",
    "내부자거래": "dept_compliance",

    "커뮤니케이션": "dept_comm",
    "홍보": "dept_comm",
    "IR": "dept_comm",
    "브랜드": "dept_comm",

    "투자운용": "dept_invest",
    "주식운용": "dept_invest",
    "채권운용": "dept_invest",
    "대체투자": "dept_invest",

    "프로젝트투자": "dept_project",
}


# ──────────────────────────────────────────────
# 카테고리별 추천 질문
# ──────────────────────────────────────────────
SUGGESTED_QUESTIONS: dict[str, list[str]] = {
    "vacation": ["반차도 사용할 수 있나요?", "연차 신청은 어떻게 해?", "신입사원 연차는 며칠?", "경조사 휴가는 며칠이야?", "증권업무 중 연차 사용 원칙은?"],
    "benefits": ["건강검진은 언제 받나요?", "의료비 지원 한도는?", "명절 선물은 뭐가 있어?", "동호회 지원이 있나요?", "복리후생 전체 목록 알려줘"],
    "guide_card": ["법인카드 사용 원칙이 뭐야?", "영수증 분실하면 어떡해?", "주말/심야 사용 시 어떻게 해?", "접대비 기준이 어떻게 돼?"],
    "guide_taxi": ["업무택시 이용 방법은?", "야근 택시 기준이 뭐야?", "택시 예산 한도는?", "카카오T 비즈니스 가입은?"],
    "guide_vehicle": ["법인차량 예약은 어떻게 해?", "차량 운행 기록은?", "법인차량 보험은?"],
    "guide_pc": ["필수 설치 프로그램이 뭐야?", "HTS 세팅은 어떻게 해?", "멀티모니터 설정 방법은?", "보안 프로그램은 뭐가 있어?"],
    "guide_it": ["시스템 권한 신청은 어떻게 해?", "VPN 접속 방법은?", "ERP 권한은 어떻게 신청해?", "그룹웨어 계정은 어떻게 만들어?"],
    "dept_ict": ["ICT부문은 어떤 팀이 있어?", "IT기획팀은 뭘 해?", "정보보안팀 업무는?"],
    "dept_finance": ["인사팀 업무가 뭐야?", "총무팀은 뭘 담당해?", "급여 관련 문의는?"],
    "dept_compliance": ["준법감시 교육은 언제?", "개인매매 규정이 뭐야?", "내부통제 규정은?"],
    "dept_research": ["리서치센터는 어떤 팀이 있어?", "애널리스트 업무는?"],
    "dept_invest": ["투자운용부문은 뭘 해?", "주식운용팀 업무는?"],
}


def get_suggested_questions(categories: list[str]) -> list[str]:
    """매칭된 카테고리를 기반으로 관련 추천 질문을 반환."""
    questions: list[str] = []
    seen = set()
    for cat in categories:
        for q in SUGGESTED_QUESTIONS.get(cat, []):
            if q not in seen:
                questions.append(q)
                seen.add(q)
    return questions[:6]  # 넉넉히 보내고 프론트에서 필터링


def _load_doc(filename: str) -> str:
    """시드 문서 파일을 읽어 텍스트로 반환."""
    path = SEED_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def extract_keywords(question: str) -> list[str]:
    """사용자 질문에서 매핑 테이블에 존재하는 키워드를 추출."""
    found: list[str] = []
    q_lower = question.lower()
    # 긴 키워드부터 매칭 (ex: "재택근무"가 "재택"보다 먼저)
    sorted_keywords = sorted(KEYWORD_MAP.keys(), key=len, reverse=True)
    for keyword in sorted_keywords:
        if keyword.lower() in q_lower:
            found.append(keyword)
            # 같은 카테고리의 하위 키워드 중복 방지
            q_lower = q_lower.replace(keyword.lower(), " ")
    return found


def route(question: str) -> list[RouteResult]:
    """
    사용자 질문을 분석하여 관련 문서를 반환.

    Returns:
        매칭된 카테고리별 RouteResult 리스트.
        매칭이 없으면 빈 리스트 반환 (fallback 처리는 호출자가 담당).
    """
    keywords = extract_keywords(question)
    if not keywords:
        return []

    # 카테고리별로 그룹핑
    category_keywords: dict[str, list[str]] = {}
    for kw in keywords:
        cat = KEYWORD_MAP[kw]
        category_keywords.setdefault(cat, []).append(kw)

    results: list[RouteResult] = []
    for cat, kws in category_keywords.items():
        doc_files = CATEGORY_DOCS.get(cat, [])
        for doc_file in doc_files:
            content = _load_doc(doc_file)
            if content:
                results.append(RouteResult(
                    category=cat,
                    matched_keywords=kws,
                    doc_content=content,
                    doc_source=doc_file,
                ))

    return results
