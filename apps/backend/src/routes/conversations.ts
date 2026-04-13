import { FastifyInstance } from 'fastify'
import { SocketStream } from '@fastify/websocket'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { conversations, messages, surveyResponses, surveyQuestions, users as usersTable } from '../db/schema'
import type { Conversation, Message, SendMessageRequest, SendMessageResponse } from '@chat-ki-s/shared'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8001'

async function handleSurveyComplete(surveyId: string, userId: string) {
  // 설문 결과 조회
  const response = (await db.select().from(surveyResponses).where(eq(surveyResponses.id, surveyId)))[0]
  if (!response) return

  const questions = (await db.select().from(surveyQuestions).where(eq(surveyQuestions.quarter, response.quarter)))[0]
  if (!questions) return

  const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)))[0]
  if (!user) return

  // LLM으로 주관식 분석
  let analysis = ''
  if (response.freeAnswer) {
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `다음 온보딩 설문 주관식 답변을 분석해주세요. 감정, 핵심 키워드, 요약을 간결하게 작성해주세요.\n\n질문: ${questions.freeQuestion}\n답변: ${response.freeAnswer}`,
          mode: 'rag',
        }),
      })
      if (aiRes.ok) {
        const body = await aiRes.json() as any
        analysis = body.answer || ''
      }
    } catch {}
  }

  // 분석 결과만 DB에 저장 (메일 발송 없음 — 인사팀이 직접 조회)
  await db.update(surveyResponses).set({ analysis }).where(eq(surveyResponses.id, surveyId))
}

export async function conversationRoutes(app: FastifyInstance) {
  // POST /api/conversations — create a new conversation
  app.post<{ Body: { title?: string } }>('/api/conversations', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 255 },
        },
      },
    },
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const title = request.body?.title ?? 'New Conversation'

    const result = await db
      .insert(conversations)
      .values({ userId: payload.sub, title })
      .returning()

    const conv = result[0]
    const response: Omit<Conversation, 'messages'> & { messages: Message[] } = {
      id: conv.id,
      userId: conv.userId,
      title: conv.title,
      messages: [],
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }

    return reply.status(201).send(response)
  })

  // GET /api/conversations — list conversations for the current user
  app.get('/api/conversations', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const payload = request.user as { sub: string }

    const { desc } = require('drizzle-orm')
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, payload.sub))
      .orderBy(desc(conversations.updatedAt))

    const result: Array<Omit<Conversation, 'messages'> & { messages: Message[] }> = rows.map(conv => ({
      id: conv.id,
      userId: conv.userId,
      title: conv.title,
      messages: [],
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }))

    return reply.send(result)
  })

  // DELETE /api/conversations/:id — delete a conversation and its messages
  app.delete<{ Params: { id: string } }>('/api/conversations/:id', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const { id } = request.params

    const convRows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
    if (!convRows.length || convRows[0].userId !== payload.sub) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    // 메시지 먼저 삭제 후 대화 삭제
    await db.delete(messages).where(eq(messages.conversationId, id))
    await db.delete(conversations).where(eq(conversations.id, id))
    return { success: true }
  })

  // POST /api/conversations/:id/messages — add a user message and get AI response
  app.post<{ Params: { id: string }; Body: SendMessageRequest }>('/api/conversations/:id/messages', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['content', 'mode'],
        properties: {
          content: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['rag', 'objective'] },
          pageContext: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const { id: conversationId } = request.params
    const { content, mode } = request.body
    const pageContext = (request.body as any).pageContext as string | undefined

    // Verify conversation belongs to current user
    const convRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    const conv = convRows[0]
    if (!conv || conv.userId !== payload.sub) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    // 사용자 프로필 조회 (AI에 전달할 컨텍스트용)
    const currentUser = (await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1))[0]
    const userContext = currentUser ? `${currentUser.name} (${currentUser.department})` : ''

    // Save user message
    await db
      .insert(messages)
      .values({ conversationId, role: 'user', content })

    // 대화 히스토리 조회
    const recentMsgs = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    // Function Calling 방식: LLM이 도구 선택 → 실행 → 결과 → 최종 답변
    let assistantContent = ''
    let agentAction: { action: string; params: Record<string, unknown>; confirmationMessage: string } | undefined
    const suggestedQuestions: string[] = []
    const ragSources: { title: string; url?: string; excerpt?: string }[] = []

    try {
      const { executeTool } = require('../services/toolExecutor')

      // 진행 중인 설문이 있는지 체크
      let surveyContext = ''
      const activeSurvey = await db.select().from(surveyResponses)
        .where(eq(surveyResponses.userId, payload.sub))
      const inProgressSurvey = activeSurvey.find((s: any) => s.status === 'in_progress')
      if (inProgressSurvey) {
        const sq = await db.select().from(surveyQuestions).where(eq(surveyQuestions.quarter, inProgressSurvey.quarter))
        const q = sq[0]
        if (q) {
          const step = inProgressSurvey.currentStep || 1
          surveyContext = `[진행 중인 설문조사]\nsurveyId: ${inProgressSurvey.id}\n현재 진행 단계: Q${step}\n사용자의 답변 "${content}"을 submit_survey_answer(surveyId="${inProgressSurvey.id}", step=${step}, answer="${content}")로 제출하세요.`
        }
      }

      // 1단계: LLM에 메시지 전달 (function calling)
      const agentHistory = recentMsgs.slice(-8).map((m: { role: string; content: string }) => ({
        role: m.role, content: m.content,
      }))

      const messageWithContext = surveyContext ? `${surveyContext}\n\n${content}` : content

      const toolsRes = await fetch(`${AI_SERVICE_URL}/chat/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageWithContext, history: agentHistory, pageContext: pageContext || undefined, userContext: userContext || undefined }),
      })

      if (!toolsRes.ok) throw new Error('tools chat failed')

      let toolsBody = await toolsRes.json() as any
      let loops = 0
      const MAX_LOOPS = 3

      // 도구 호출 루프 (최대 3회)
      while (toolsBody.type === 'tool_calls' && loops < MAX_LOOPS) {
        loops++
        const toolResults: any[] = []

        for (const tc of toolsBody.tool_calls) {
          const args = JSON.parse(tc.arguments || '{}')

          // search_documents / search_restaurant는 AI 서비스의 RAG를 호출
          if (tc.name === 'search_documents' || tc.name === 'search_restaurant') {
            const isRestaurant = tc.name === 'search_restaurant'
            // LLM이 축약한 query와 원본 질문을 결합하여 검색 정확도 향상
            const searchQuery = args.query || content
            const ragRes = await fetch(`${AI_SERVICE_URL}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: searchQuery, mode: 'rag', history: agentHistory }),
            })
            if (ragRes.ok) {
              const ragBody = await ragRes.json() as any
              let ragContent = ragBody.answer || '관련 문서를 찾지 못했습니다.'
              // 출처 표시: 맛집 검색은 출처 생략, 문서 검색은 맛집 출처 제외 후 표시
              if (ragBody.sources?.length > 0 && !isRestaurant) {
                const nonFoodSources = ragBody.sources.filter((s: any) => !s.source?.startsWith('맛집'))
                if (nonFoodSources.length > 0) {
                  const sourceNames = nonFoodSources
                    .map((s: any) => s.source?.replace('.md', '').replace(/_/g, ' '))
                    .filter((s: any, i: number, arr: any[]) => s && arr.indexOf(s) === i)
                  if (sourceNames.length > 0) {
                    ragContent += `\n📄 출처: ${sourceNames.join(', ')}`
                  }
                  for (const s of nonFoodSources) {
                    const title = s.source?.replace('.md', '').replace(/_/g, ' ') || ''
                    if (title && !ragSources.find(rs => rs.title === title)) {
                      ragSources.push({ title })
                    }
                  }
                }
              }
              toolResults.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: ragContent,
              })
            } else {
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: isRestaurant ? '맛집 검색에 실패했습니다.' : '문서 검색에 실패했습니다.' })
            }
          } else {
            // 일반 도구 실행
            const result = await executeTool(tc.name, args, payload.sub)

            // 시그널 처리
            if (result.result.startsWith('__SURVEY_COMPLETE__:')) {
              const sid = result.result.split(':')[1]
              handleSurveyComplete(sid, payload.sub).catch(() => {})
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: '설문이 완료되었습니다! 🎉\n\n소중한 의견을 보내주셔서 감사합니다.\n키움증권에서의 앞으로의 회사 생활도 진심으로 응원하겠습니다!\n\n[주의] 사용자의 답변 내용을 반복하거나 요약하지 마세요. 위 메시지를 그대로 전달하세요.' })
            } else if (result.result.startsWith('__GLOSSARY_SEARCH__:')) {
              // DB 매칭 실패 → ChromaDB 벡터 검색 fallback
              const searchTerm = result.result.replace('__GLOSSARY_SEARCH__:', '')
              try {
                const vecRes = await fetch(`${AI_SERVICE_URL}/glossary/search`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: searchTerm, topK: 3 }),
                })
                if (vecRes.ok) {
                  const vecBody = await vecRes.json() as any
                  if (vecBody.results?.length > 0) {
                    const list = vecBody.results.map((r: any, i: number) =>
                      `${i + 1}. **${r.term}** (유사도: ${(r.score * 100).toFixed(0)}%)\n${r.description.slice(0, 400)}`
                    ).join('\n\n')
                    toolResults.push({ role: 'tool', tool_call_id: tc.id, content: `"${searchTerm}" 관련 금융 용어:\n\n${list}` })
                  } else {
                    toolResults.push({ role: 'tool', tool_call_id: tc.id, content: `"${searchTerm}" 관련 금융 용어를 찾지 못했습니다.` })
                  }
                } else {
                  toolResults.push({ role: 'tool', tool_call_id: tc.id, content: `용어 검색에 실패했습니다.` })
                }
              } catch {
                toolResults.push({ role: 'tool', tool_call_id: tc.id, content: `용어 검색 중 오류가 발생했습니다.` })
              }
            } else {
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result.result })
            }

            // 액션 요청 (연차 신청 등)이면 agentAction 설정
            if (result.agentAction) {
              agentAction = result.agentAction
            }
          }
        }

        // 도구 결과를 LLM에 전달하여 최종 답변 생성
        const continueMessages = [...toolsBody.messages, ...toolResults]
        const continueRes = await fetch(`${AI_SERVICE_URL}/chat/tools/continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: continueMessages }),
        })

        if (!continueRes.ok) break
        toolsBody = await continueRes.json()
      }

      if (toolsBody.type === 'answer') {
        // agentAction이 있으면 확인 메시지를 본문으로 사용
        if (agentAction?.confirmationMessage) {
          assistantContent = agentAction.confirmationMessage
        } else {
          assistantContent = toolsBody.answer || ''
        }

        // agent_logs 제거됨 — good_answers로 대체
      }
    } catch (err) {
      // Function calling 실패 시 기존 RAG fallback
      try {
        const historyRows = recentMsgs.slice(-8).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
        const aiRes = await fetch(`${AI_SERVICE_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: content, mode, history: historyRows, ...(pageContext ? { pageContext } : {}) }),
        })
        if (aiRes.ok) {
          const aiBody = await aiRes.json() as any
          assistantContent = aiBody.answer ?? ''
        }
      } catch {
        // RAG도 실패
      }
    }

    // 빈 응답 방지
    if (!assistantContent.trim()) {
      assistantContent = '죄송합니다. 일시적으로 응답을 생성하지 못했습니다. 다시 질문해 주세요.'
    }

    // Save assistant message
    const asstMsgResult = await db
      .insert(messages)
      .values({ conversationId, role: 'assistant', content: assistantContent })
      .returning()

    const asstMessage = asstMsgResult[0]

    // 첫 메시지면 대화 제목 자동 생성
    const msgCount = await db
      .select({ role: messages.role })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
    // user + assistant = 2개면 첫 대화
    if (msgCount.length <= 2) {
      // 질문에서 제목 추출 (최대 30자)
      let title = content.replace(/\n/g, ' ').trim()
      if (title.length > 30) title = title.slice(0, 30) + '...'
      await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
    } else {
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
    }

    const response: SendMessageResponse = {
      conversationId,
      message: {
        id: asstMessage.id,
        conversationId: asstMessage.conversationId,
        role: asstMessage.role as 'assistant',
        content: asstMessage.content,
        createdAt: asstMessage.createdAt,
        ...(agentAction ? { agentAction: { action: agentAction.action, params: agentAction.params, confirmationMessage: agentAction.confirmationMessage } } : {}),
        ...(suggestedQuestions.length ? { suggestedQuestions } : {}),
        ...(ragSources.length ? { sources: ragSources } : {}),
      },
    }

    return reply.send(response)
  })

  // GET /api/conversations/:id/messages — list messages in a conversation
  app.get<{ Params: { id: string } }>('/api/conversations/:id/messages', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const { id: conversationId } = request.params

    // Verify conversation belongs to current user
    const convRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    const conv = convRows[0]
    if (!conv || conv.userId !== payload.sub) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    const result: Message[] = rows.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt,
    }))

    return reply.send(result)
  })

  // WebSocket: ws://.../api/conversations/:id/stream
  // Streams AI response tokens in real time
  app.get<{ Params: { id: string } }>('/api/conversations/:id/stream', {
    websocket: true,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (connection: SocketStream, request) => {
    const { id: conversationId } = request.params
    const ws = connection.socket

    ws.on('message', async (rawMsg: Buffer) => {
      let parsed: { content: string; mode?: string }
      try {
        parsed = JSON.parse(rawMsg.toString())
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
        return
      }

      const { content, mode = 'rag' } = parsed

      // Save user message
      await db
        .insert(messages)
        .values({ conversationId, role: 'user', content })
        .returning()

      ws.send(JSON.stringify({ type: 'start' }))

      // Stream from AI service
      let fullContent = ''
      try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: content, mode }),
        })

        if (aiRes.ok && aiRes.body) {
          const reader = aiRes.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // Parse SSE lines: each event is "data: {...}\n\n"
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''

            for (const event of events) {
              const line = event.trim()
              if (!line.startsWith('data: ')) continue
              try {
                const parsed = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; sources?: unknown[]; is_fallback?: boolean }
                if (parsed.token !== undefined) {
                  fullContent += parsed.token
                  ws.send(JSON.stringify({ type: 'chunk', content: parsed.token }))
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }
        }
      } catch {
        // AI service unavailable
      }

      // Save assistant message
      const asstResult = await db
        .insert(messages)
        .values({ conversationId, role: 'assistant', content: fullContent })
        .returning()

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))

      ws.send(JSON.stringify({ type: 'done', messageId: asstResult[0].id }))
    })
  })
}
