'use client'

import { useEffect, useState, FormEvent } from 'react'
import { getInbox, getSentMails, getStarredMails, getDraftMails, getTrashMails, getMail, sendMail, toggleStarMail, deleteMail, restoreMail } from '@/lib/api'
import type { Mail } from '@/lib/api'
import { usePageContext } from '@/contexts/PageContext'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'

const FOLDERS = [
  { key: 'inbox', label: '받은 편지함' },
  { key: 'starred', label: '별표 편지함' },
  { key: 'sent', label: '보낸 편지함' },
  { key: 'draft', label: '임시 보관함' },
  { key: 'trash', label: '휴지통' },
]

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} ${time}`
}

function extractSenderLabel(mail: Mail): string {
  if (mail.fromText) {
    // "진강연 사원 (인사이트랩팀)  <jky0002@kiwoom.com>" → "진강연(인사이트랩팀)"
    const nameMatch = mail.fromText.match(/^([가-힣]+)/)
    const teamMatch = mail.fromText.match(/\(([^)]+)\)/)
    if (nameMatch) {
      const name = nameMatch[1]
      const team = teamMatch ? teamMatch[1] : ''
      return team ? `${name}(${team})` : name
    }
  }
  return '보낸사람'
}

function renderEmailField(text: string) {
  // 모든 이메일 주소를 개별적으로 클릭 가능하게 변환
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const result: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = emailRegex.exec(text)) !== null) {
    // 이메일 앞의 텍스트
    if (match.index > lastIndex) {
      result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    // 이메일 주소 (클릭 가능)
    const email = match[0]
    result.push(
      <button
        key={`e${match.index}`}
        onClick={(e) => {
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent('compose-mail', { detail: { email } }))
        }}
        className="hover:underline cursor-pointer"
        style={{ color: '#3B82F6' }}
      >
        {email}
      </button>
    )
    lastIndex = match.index + match[0].length
  }
  // 마지막 남은 텍스트
  if (lastIndex < text.length) {
    result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }
  return result.length > 0 ? result : text
}

export default function MailsPage() {
  const [mails, setMails] = useState<Mail[]>([])
  const [selected, setSelected] = useState<Mail | null>(null)
  const [activeFolder, setActiveFolder] = useState('inbox')
  const [composing, setComposing] = useState(false)
  const [toId, setToId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const { userName, userDept, userRole } = useUser()
  const { setPageContext, clearPageContext } = usePageContext()

  // 메일 선택 시 페이지 컨텍스트 업데이트
  useEffect(() => {
    if (selected) {
      setPageContext({
        type: 'mail',
        title: selected.subject,
        content: selected.body,
        metadata: `발신: ${selected.fromText || ''}\\n수신: ${selected.toText || ''}`,
      })
    } else {
      clearPageContext()
    }
  }, [selected])

  async function fetchMails(folder: string) {
    try {
      let data: Mail[]
      switch (folder) {
        case 'inbox': data = await getInbox(); break
        case 'sent': data = await getSentMails(); break
        case 'starred': data = await getStarredMails(); break
        case 'draft': data = await getDraftMails(); break
        case 'trash': data = await getTrashMails(); break
        default: data = await getInbox()
      }
      setMails(data)
    } catch { setMails([]) }
  }

  useEffect(() => { fetchMails(activeFolder) }, [activeFolder])

  // 이메일 주소 클릭 시 메일 쓰기 창 열기
  useEffect(() => {
    function handleCompose(e: Event) {
      const email = (e as CustomEvent).detail?.email
      if (email) {
        setComposing(true)
        setSelected(null)
        setToId(email)
        setSubject('')
        setBody('')
      }
    }
    window.addEventListener('compose-mail', handleCompose)
    return () => window.removeEventListener('compose-mail', handleCompose)
  }, [])

  const filteredMails = readFilter === 'all' ? mails
    : readFilter === 'unread' ? mails.filter((m) => !m.isRead)
    : mails.filter((m) => m.isRead)

  const unreadCount = mails.filter((m) => !m.isRead).length

  const allSelected = filteredMails.length > 0 && filteredMails.every((m) => selectedIds.has(m.id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMails.map((m) => m.id)))
    }
  }

  function toggleSelectOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    for (const id of selectedIds) {
      try { await deleteMail(id) } catch {}
    }
    setSelectedIds(new Set())
    fetchMails(activeFolder)
  }

  async function handleBulkStar() {
    for (const id of selectedIds) {
      try { await toggleStarMail(id) } catch {}
    }
    setSelectedIds(new Set())
    fetchMails(activeFolder)
  }

  function handleReply() {
    if (!selected) return
    const replyTo = selected.fromText?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || ''
    setComposing(true)
    setToId(replyTo)
    setSubject(`RE: ${selected.subject.replace(/^RE:\s*/i, '')}`)
    setBody(`\n\n--- 원본 메일 ---\n${selected.body}`)
    setSelected(null)
  }

  function handleForward() {
    if (!selected) return
    setComposing(true)
    setToId('')
    setSubject(`FW: ${selected.subject.replace(/^(RE:|FW:)\s*/gi, '')}`)
    setBody(`\n\n--- 전달된 메일 ---\n보낸사람: ${selected.fromText || ''}\n\n${selected.body}`)
    setSelected(null)
  }

  const folderLabels: Record<string, string> = {
    inbox: '받은 편지함', starred: '별표 편지함', sent: '보낸 편지함', draft: '임시 보관함', trash: '휴지통',
  }

  async function handleSelect(mail: Mail) {
    setSelected(mail); setComposing(false)
    if (!mail.isRead) {
      try { await getMail(mail.id); setMails((prev) => prev.map((m) => m.id === mail.id ? { ...m, isRead: 'true' } : m)) } catch {}
    }
  }

  async function handleStar(mailId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    try {
      const res = await toggleStarMail(mailId)
      setMails((prev) => prev.map((m) => m.id === mailId ? { ...m, starred: res.starred } : m))
      if (selected?.id === mailId) setSelected((s) => s ? { ...s, starred: res.starred } : s)
    } catch (err) {
      console.error('Star toggle failed:', err)
    }
  }

  async function handleDelete(mailId: string) {
    try {
      await deleteMail(mailId)
      if (selected?.id === mailId) setSelected(null)
      // 모든 폴더에서 삭제 반영되도록 refetch
      fetchMails(activeFolder)
    } catch {}
  }

  async function handleRestore(mailId: string) {
    try {
      await restoreMail(mailId)
      if (selected?.id === mailId) setSelected(null)
      fetchMails(activeFolder)
    } catch {}
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!toId || !subject || !body) return
    setSending(true)
    try {
      await sendMail({ toEmployeeId: toId, subject, body })
      setComposing(false); setToId(''); setSubject(''); setBody('')
      fetchMails(activeFolder)
    } catch {} finally { setSending(false) }
  }

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
      {/* 폴더 목록 - Figma 스펙 반영 */}
      <div className="px-4 py-6 space-y-1">
        {FOLDERS.map((f) => {
          const isActive = activeFolder === f.key
          return (
            <button
              key={f.key}
              onClick={() => { setActiveFolder(f.key); setSelected(null); setComposing(false); setSelectedIds(new Set()) }}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              style={{
                borderRadius: 48,
                color: isActive ? '#E1007F' : '#475569',
                background: isActive ? '#FFF' : 'transparent',
                boxShadow: isActive ? '0px 1px 2px rgba(0,0,0,0.05)' : 'none',
                fontSize: 16,
                fontFamily: 'Pretendard',
                fontWeight: 500,
                lineHeight: '24px',
              }}
            >
              <span>{f.label}</span>
              {f.key === 'inbox' && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(225,0,127,0.10)', color: '#E1007F', fontFamily: 'Manrope', fontWeight: 700 }}>{unreadCount}</span>
              )}
            </button>
          )
        })}
      </div>
    </IntranetSidebar>

    {/* 메인 영역 */}
    <div className="flex-1 flex flex-col overflow-hidden p-8 gap-8">
      {/* 상단 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 style={{ color: '#111547', fontSize: 30, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '36px' }}>{folderLabels[activeFolder]}</h1>
          <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '20px' }}>
            {activeFolder === 'inbox' ? `오늘 새로운 메일이 ${unreadCount}건 도착했습니다.` :
             activeFolder === 'trash' ? `${mails.length}건의 메일이 휴지통에 있습니다.` :
             `${mails.length}건의 메일`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: '#FFF', boxShadow: '0px 1px 2px rgba(0,0,0,0.05)', border: '1px solid #EDEEEF', color: '#191C1D', fontSize: 14 }}
            >
              {readFilter === 'all' ? '모든 메일' : readFilter === 'unread' ? '읽지 않은 메일' : '읽은 메일'} ▾
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border z-10 py-1 min-w-[140px]">
                {[
                  { key: 'all' as const, label: '모든 메일' },
                  { key: 'unread' as const, label: '읽지 않은 메일' },
                  { key: 'read' as const, label: '읽은 메일' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setReadFilter(opt.key); setFilterOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    style={{ color: readFilter === opt.key ? '#E1007F' : '#475569', fontWeight: readFilter === opt.key ? 600 : 400 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setComposing(true); setSelected(null) }} className="flex items-center gap-2 px-8 py-3 rounded-full text-white" style={{ background: '#E1007F', fontSize: 16, fontWeight: 500, boxShadow: '0px 4px 6px -4px rgba(225,0,127,0.20), 0px 10px 15px -3px rgba(225,0,127,0.20)' }}>
            ✉️ 메일 쓰기
          </button>
        </div>
      </div>

      {/* 메일 리스트 + 상세 (가로 배치) */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* 메일 리스트 카드 */}
        <div className="flex flex-col bg-white overflow-hidden transition-all duration-300" style={{ borderRadius: 48, boxShadow: '0px 1px 2px rgba(0,0,0,0.05)', width: selected || composing ? '40%' : '100%', minWidth: 360, flexShrink: 0 }}>
          {/* 전체 선택 바 */}
          <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid #F3F4F5' }}>
            <button onClick={toggleSelectAll} className="flex items-center gap-4">
              <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: '1px solid #E1E3E4', background: allSelected ? '#E1007F' : 'transparent' }}>
                {allSelected && <svg width="8" height="6" viewBox="0 0 8 6" fill="white"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
              </div>
              <span style={{ color: '#111547', fontSize: 14, fontWeight: 500 }}>전체 선택</span>
            </button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#94A3B8' }}>{selectedIds.size}건 선택</span>
                <button onClick={handleBulkStar} className="text-xs px-2 py-1 rounded-full hover:bg-gray-100" title="별표">☆</button>
                <button onClick={handleBulkDelete} className="text-xs px-2 py-1 rounded-full hover:bg-red-50" style={{ color: '#BA1A1A' }} title="삭제">삭제</button>
              </div>
            )}
          </div>
          {/* 메일 목록 */}
          <div className="flex-1 overflow-y-auto">
            {mails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full" style={{ color: '#CBD5E1' }}>
                <span className="text-3xl mb-2">📭</span>
                <p className="text-xs">메일이 없습니다</p>
              </div>
            ) : (
              filteredMails.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className="w-full text-left p-5 flex flex-col gap-1 cursor-pointer"
                  style={{
                    borderBottom: '1px solid #F3F4F5',
                    borderLeft: selected?.id === m.id ? '4px solid #F3F4F5' : '4px solid transparent',
                    background: selectedIds.has(m.id) ? 'rgba(225,0,127,0.03)' : selected?.id === m.id ? 'rgba(225,0,127,0.05)' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        onClick={(e) => toggleSelectOne(m.id, e)}
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center cursor-pointer"
                        style={{ border: '1px solid #E1E3E4', background: selectedIds.has(m.id) ? '#E1007F' : 'transparent' }}
                      >
                        {selectedIds.has(m.id) && <svg width="6" height="5" viewBox="0 0 8 6" fill="white"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                      </div>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleStar(m.id, e) }}
                        className="flex-shrink-0 text-sm cursor-pointer select-none"
                        style={{ color: m.starred ? '#FBBF24' : '#CBD5E1' }}
                        title={m.starred ? '별표 해제' : '별표'}
                      >{m.starred ? '★' : '☆'}</span>
                      <span className="truncate" style={{ color: selected?.id === m.id || !m.isRead ? '#E1007F' : '#111547', fontSize: 13, fontWeight: 500 }}>보낸사람: {extractSenderLabel(m)}</span>
                    </div>
                    <span className="flex-shrink-0" style={{ color: 'rgba(17,21,71,0.40)', fontSize: 10, fontFamily: 'Manrope', fontWeight: 400 }}>{formatTime(m.createdAt)}</span>
                  </div>
                  <span style={{ color: '#111547', fontSize: 14, fontWeight: 500, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                  <span style={{ color: 'rgba(17,21,71,0.60)', fontSize: 12, fontWeight: 500, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body.slice(0, 60)}...</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 메일 상세 / 작성 카드 */}
        {(selected || composing) && (
          <div className="flex-1 bg-white overflow-hidden ml-0 flex flex-col" style={{ borderRadius: 48, boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}>
            {composing ? (
              <div className="p-8 flex-1 overflow-y-auto">
                <h2 style={{ color: '#111547', fontSize: 30, fontWeight: 500, marginBottom: 24 }}>새 메일</h2>
                <form onSubmit={handleSend} className="space-y-4">
                  <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <span className="text-sm w-20" style={{ color: '#94A3B8' }}>받는사람</span>
                    <input type="text" value={toId} onChange={(e) => setToId(e.target.value)} placeholder="사번 (예: 20260002)" required className="flex-1 text-sm outline-none" />
                  </div>
                  <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <span className="text-sm w-20" style={{ color: '#94A3B8' }}>제목</span>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="메일 제목" required className="flex-1 text-sm outline-none" />
                  </div>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="내용을 입력하세요" required rows={12} className="w-full text-base outline-none resize-none" style={{ color: '#475569', lineHeight: '26px' }} />
                  <div className="flex gap-3">
                    <button type="submit" disabled={sending} className="px-8 py-2 rounded-full text-white" style={{ background: '#E1007F' }}>{sending ? '보내는 중...' : '보내기'}</button>
                    <button type="button" onClick={() => setComposing(false)} className="px-8 py-2 rounded-full" style={{ background: '#E7E8E9', color: '#111547' }}>취소</button>
                  </div>
                </form>
              </div>
            ) : selected ? (
              <>
                {/* 액션 바 */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F5' }}>
                  <div className="flex items-center gap-3">
                    <button onClick={handleReply} className="flex items-center gap-2 px-6 py-2 rounded-full text-xs font-medium text-white" style={{ background: '#111547' }}>
                      ↩ 답장하기
                    </button>
                    <button onClick={handleForward} className="flex items-center gap-2 px-6 py-2 rounded-full text-xs font-medium" style={{ background: '#E7E8E9', color: '#111547' }}>
                      ➡ 전달
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-full"><svg className="w-5 h-5" style={{ color: 'rgba(17,21,71,0.60)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                    {activeFolder === 'trash' ? (
                      <button onClick={() => selected && handleRestore(selected.id)} className="p-2 rounded-full" title="복원"><svg className="w-5 h-5" style={{ color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 010 10H9m4-10l-4-4m4 4l-4 4" /></svg></button>
                    ) : (
                      <button onClick={() => selected && handleDelete(selected.id)} className="p-2 rounded-full" title="삭제"><svg className="w-5 h-5" style={{ color: '#BA1A1A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    )}
                  </div>
                </div>
                {/* 메일 헤더 + 본문 */}
                <div className="flex-1 overflow-y-auto px-12 py-10">
                  {/* 메일 메타 정보 */}
                  <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td className="py-2.5 pr-4 align-top" style={{ color: '#E1007F', fontSize: 13, fontWeight: 600, width: 50 }}>제목</td>
                        <td className="py-2.5" style={{ color: '#111547', fontSize: 14, fontWeight: 500 }}>{selected.subject}</td>
                        <td className="py-2.5 text-right align-top" style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'Manrope', whiteSpace: 'nowrap' }}>
                          {new Date(selected.createdAt).toLocaleDateString('ko-KR')} {new Date(selected.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td className="py-2.5 pr-4 align-top" style={{ color: '#E1007F', fontSize: 13, fontWeight: 600 }}>발신</td>
                        <td className="py-2.5" colSpan={2} style={{ color: '#475569', fontSize: 13 }}>{renderEmailField(selected.fromText || extractSenderLabel(selected))}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td className="py-2.5 pr-4 align-top" style={{ color: '#E1007F', fontSize: 13, fontWeight: 600 }}>수신</td>
                        <td className="py-2.5" colSpan={2} style={{ color: '#475569', fontSize: 13 }}>{renderEmailField(selected.toText || '수신자 정보 없음')}</td>
                      </tr>
                      {selected.cc && (
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td className="py-2.5 pr-4 align-top" style={{ color: '#E1007F', fontSize: 13, fontWeight: 600 }}>참조</td>
                          <td className="py-2.5" colSpan={2} style={{ color: '#94A3B8', fontSize: 12 }}>{renderEmailField(selected.cc)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* 본문 */}
                  <div style={{ color: '#475569', fontSize: 15, fontWeight: 400, lineHeight: '26px', overflowX: 'auto', maxWidth: '100%' }} className="whitespace-pre-wrap">{selected.body}</div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
