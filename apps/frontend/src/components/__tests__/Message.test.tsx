import { render, screen } from '@testing-library/react'
import Message from '../Message'
import type { Message as MessageType } from '@chat-ki-s/shared'

const base: MessageType = {
  id: '1',
  conversationId: 'conv-1',
  content: '안녕하세요',
  createdAt: new Date(),
  role: 'user',
}

describe('Message', () => {
  it('renders user message aligned to the right', () => {
    render(<Message message={{ ...base, role: 'user' }} />)
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument()
  })

  it('renders assistant message aligned to the left', () => {
    render(<Message message={{ ...base, role: 'assistant' }} />)
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('applies user bubble styles for user role', () => {
    render(<Message message={{ ...base, role: 'user' }} />)
    const bubble = screen.getByText('안녕하세요')
    expect(bubble).toHaveClass('bg-blue-600')
  })

  it('applies assistant bubble styles for assistant role', () => {
    render(<Message message={{ ...base, role: 'assistant' }} />)
    const bubble = screen.getByText('안녕하세요')
    expect(bubble).toHaveClass('bg-gray-100')
  })
})
