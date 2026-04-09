export interface KnowledgeSource {
  title: string
  content: string
}

export interface LLMResponse {
  answer: string
  sources: KnowledgeSource[]
}

const SYSTEM_PROMPT = `당신은 키움증권 신입사원 온보딩을 돕는 친절한 챗봇 "키움이"입니다.
- 신입사원이 이해하기 쉽게 친근하고 따뜻한 말투로 답변하세요.
- 제공된 문서/FAQ 내용을 바탕으로 정확하게 안내하세요.
- 모르는 내용은 솔직하게 모른다고 하고, 담당 부서 문의를 안내하세요.
- 답변 후 관련 출처(문서/FAQ 제목)를 명시하세요.`

export async function callLLM(
  question: string,
  sources: KnowledgeSource[]
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      answer: getFallbackAnswer(),
      sources: [],
    }
  }

  const contextText =
    sources.length > 0
      ? sources
          .map((s, i) => `[출처 ${i + 1}] ${s.title}\n${s.content}`)
          .join('\n\n')
      : '(관련 문서 없음)'

  const userMessage = `다음 문서를 참고하여 질문에 답변해주세요.\n\n${contextText}\n\n질문: ${question}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  const answer = data.choices[0]?.message?.content ?? getFallbackAnswer()

  return { answer, sources }
}

function getFallbackAnswer(): string {
  return '죄송합니다. 현재 답변 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도하거나, 인사팀(hr@kiwoom.com)으로 문의해주세요.'
}
