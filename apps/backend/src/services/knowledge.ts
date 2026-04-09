import type { KnowledgeSource } from './llm'

// Static FAQ fallback — used when ChromaDB is unavailable
const STATIC_FAQ: KnowledgeSource[] = [
  {
    title: '입사 첫날 준비사항',
    content:
      '입사 첫날에는 신분증, 통장 사본, 주민등록등본을 지참해주세요. 오전 9시까지 1층 안내데스크에서 출입증을 수령하세요.',
  },
  {
    title: '복리후생 안내',
    content:
      '키움증권은 건강검진, 자녀학자금, 휴가비, 동호회 지원 등의 복리후생을 제공합니다. 자세한 내용은 HR포털에서 확인하세요.',
  },
  {
    title: '연차 및 휴가 사용',
    content:
      '연차는 입사일 기준으로 발생하며, HR포털에서 신청하실 수 있습니다. 사전 승인 후 사용 가능합니다.',
  },
  {
    title: 'IT 장비 및 시스템 접근',
    content:
      '업무용 노트북은 입사일에 IT팀에서 지급합니다. 사내 시스템 접근 계정은 이메일로 발송됩니다.',
  },
  {
    title: '사내 식당 운영 안내',
    content:
      '구내식당은 지하 1층에 위치하며, 평일 11:30~13:30에 운영합니다. 식권은 급여에서 자동 공제됩니다.',
  },
]

export async function searchKnowledge(
  query: string
): Promise<KnowledgeSource[]> {
  const chromaHost = process.env.CHROMA_HOST
  if (chromaHost) {
    try {
      return await queryChroma(chromaHost, query)
    } catch {
      // fall through to static FAQ
    }
  }
  return searchStaticFaq(query)
}

async function queryChroma(
  host: string,
  query: string
): Promise<KnowledgeSource[]> {
  const collectionRes = await fetch(
    `${host}/api/v1/collections/onboarding_docs`,
    { signal: AbortSignal.timeout(3000) }
  )
  if (!collectionRes.ok) return searchStaticFaq(query)

  const collection = (await collectionRes.json()) as { id: string }

  const queryRes = await fetch(
    `${host}/api/v1/collections/${collection.id}/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_texts: [query],
        n_results: 3,
        include: ['documents', 'metadatas'],
      }),
      signal: AbortSignal.timeout(5000),
    }
  )
  if (!queryRes.ok) return searchStaticFaq(query)

  const result = (await queryRes.json()) as {
    documents: string[][]
    metadatas: Array<Array<{ title?: string }>>
  }

  return (result.documents[0] ?? []).map((doc, i) => ({
    title: result.metadatas[0]?.[i]?.title ?? '온보딩 문서',
    content: doc,
  }))
}

function searchStaticFaq(query: string): KnowledgeSource[] {
  const q = query.toLowerCase()
  const matched = STATIC_FAQ.filter(
    (faq) =>
      faq.title.toLowerCase().includes(q) ||
      faq.content.toLowerCase().includes(q)
  )
  return matched.length > 0 ? matched.slice(0, 3) : STATIC_FAQ.slice(0, 2)
}
