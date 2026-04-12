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
  it('renders user message with content', () => {
    render(<Message message={{ ...base, role: 'user' }} />)
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument()
  })

  it('renders assistant message with content', () => {
    render(<Message message={{ ...base, role: 'assistant' }} />)
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
  })

  it('renders user message aligned to the right', () => {
    const { container } = render(<Message message={{ ...base, role: 'user' }} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('justify-end')
  })

  it('renders assistant message aligned to the left', () => {
    const { container } = render(<Message message={{ ...base, role: 'assistant' }} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('justify-start')
  })
})
