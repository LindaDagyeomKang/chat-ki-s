'use client'

import { useEffect, useRef, useState } from 'react'
import type { Conversation } from '@chat-ki-s/shared'

export interface Folder {
  id: string
  name: string
  isDefault: boolean
}

const FOLDERS_KEY = 'chat-ki-s:folders'
const ARCHIVED_KEY = 'chat-ki-s:archived'
const DEFAULT_FOLDER: Folder = { id: 'default', name: '기본 폴더', isDefault: true }

export function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    return raw ? JSON.parse(raw) : [DEFAULT_FOLDER]
  } catch { return [DEFAULT_FOLDER] }
}

function saveFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function loadArchived(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveArchived(archived: Record<string, string>) {
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(archived))
}

interface Props {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: (id: string) => void
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function ConversationItem({ conversation, isActive, onSelect, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renamingValue, setRenamingValue] = useState('')
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [archivePos, setArchivePos] = useState({ top: 0, left: 0 })
  const [folders, setFolders] = useState<Folder[]>([DEFAULT_FOLDER])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const dotsBtnRef = useRef<HTMLButtonElement>(null)
  const archiveBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const archiveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menuOpen) setFolders(loadFolders())
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      const inMenu = menuRef.current?.contains(e.target as Node)
      const inArchive = archiveRef.current?.contains(e.target as Node)
      const inDots = dotsBtnRef.current?.contains(e.target as Node)
      if (!inMenu && !inArchive && !inDots) {
        setMenuOpen(false)
        setArchiveOpen(false)
        setCreatingFolder(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  function openMenu() {
    const btn = dotsBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuHeight = 140 // 메뉴 대략 높이
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    setMenuPos({ top, left: rect.left - 120 })
    setMenuOpen(true)
    setArchiveOpen(false)
    setRenaming(false)
  }

  function handleRenameSubmit() {
    const name = renamingValue.trim()
    if (!name) { setRenaming(false); return }
    conversation.title = name  // optimistic update (local)
    setRenaming(false)
    setMenuOpen(false)
    // TODO: PATCH /api/conversations/:id when backend supports it
  }

  function openArchive() {
    const btn = archiveBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setArchivePos({ top: rect.top, left: rect.right + 4 })
    setArchiveOpen(true)
  }

  function handleArchive(folderId: string) {
    const archived = loadArchived()
    archived[conversation.id] = folderId
    saveArchived(archived)
    setMenuOpen(false)
    setArchiveOpen(false)
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    const newFolder: Folder = { id: crypto.randomUUID(), name, isDefault: false }
    const updated = [...folders, newFolder]
    saveFolders(updated)
    setFolders(updated)
    setCreatingFolder(false)
    setNewFolderName('')
    handleArchive(newFolder.id)
  }

  function handleDeleteFolder(folderId: string) {
    const customFolders = folders.filter((f) => !f.isDefault)
    if (folderId === 'default' && customFolders.length === 0) return
    const updated = folders.filter((f) => f.id !== folderId)
    if (updated.length === 0) updated.push(DEFAULT_FOLDER)
    saveFolders(updated)
    setFolders(updated)
  }

  const customFolders = folders.filter((f) => !f.isDefault)
  const canDeleteDefault = customFolders.length > 0

  return (
    <div className={`group relative flex items-center ${isActive ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'}`}>
      <button className="flex-1 text-left px-4 py-2.5 min-w-0" onClick={onSelect}>
        <p className="text-sm text-gray-800 truncate">{conversation.title || '새 대화'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDate(conversation.updatedAt)}</p>
      </button>

      {/* ⋮ 버튼 */}
      <button
        ref={dotsBtnRef}
        onClick={(e) => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenu() }}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 mr-2 rounded hover:bg-gray-200 transition-all text-gray-400"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 (fixed) */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl w-40 py-1 text-sm"
        >
          {/* 이름 바꾸기 */}
          {renaming ? (
            <div className="px-3 py-2">
              <input
                autoFocus
                value={renamingValue}
                onChange={(e) => setRenamingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-400"
              />
              <div className="flex gap-1 mt-1">
                <button onClick={handleRenameSubmit} className="flex-1 text-xs bg-blue-600 text-white rounded py-0.5">확인</button>
                <button onClick={() => setRenaming(false)} className="flex-1 text-xs bg-gray-100 text-gray-600 rounded py-0.5">취소</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setRenamingValue(conversation.title || ''); setRenaming(true) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              이름 바꾸기
            </button>
          )}

          {/* 보관 */}
          <button
            ref={archiveBtnRef}
            onMouseEnter={openArchive}
            onClick={openArchive}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
            보관
            <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 삭제 */}
          <button
            onClick={() => { onDelete(conversation.id); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            삭제
          </button>
        </div>
      )}

      {/* 폴더 서브메뉴 (fixed) */}
      {menuOpen && archiveOpen && (
        <div
          ref={archiveRef}
          style={{ position: 'fixed', top: archivePos.top, left: archivePos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl w-44 py-1 text-sm"
        >
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center group/folder hover:bg-gray-50">
              <button
                onClick={() => handleArchive(folder.id)}
                className="flex-1 flex items-center gap-2 px-3 py-2 text-gray-700 text-left"
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span className="truncate">{folder.name}</span>
              </button>
              {(folder.isDefault ? canDeleteDefault : true) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id) }}
                  className="opacity-0 group-hover/folder:opacity-100 pr-2 text-gray-300 hover:text-red-400 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {creatingFolder ? (
              <div className="px-3 py-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder()
                    if (e.key === 'Escape') setCreatingFolder(false)
                  }}
                  placeholder="폴더 이름"
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={handleCreateFolder} className="flex-1 text-xs bg-blue-600 text-white rounded py-0.5">확인</button>
                  <button onClick={() => setCreatingFolder(false)} className="flex-1 text-xs bg-gray-100 text-gray-600 rounded py-0.5">취소</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreatingFolder(true)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                폴더 생성하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
