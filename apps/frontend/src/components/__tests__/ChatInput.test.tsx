import { render, screen, fireEvent } from '@testing-library/react'
import ChatInput from '../ChatInput'

describe('ChatInput', () => {
  it('calls onSend with content and mode on submit', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/메시지를 입력하세요/)
    fireEvent.change(textarea, { target: { value: '질문합니다' } })
    fireEvent.click(screen.getByText('전송'))

    expect(onSend).toHaveBeenCalledWith('질문합니다', 'rag')
  })

  it('calls onSend on Enter key press (without Shift)', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/메시지를 입력하세요/)
    fireEvent.change(textarea, { target: { value: '엔터 전송' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('엔터 전송', 'rag')
  })

  it('does not call onSend on Shift+Enter', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/메시지를 입력하세요/)
    fireEvent.change(textarea, { target: { value: '줄바꿈' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not call onSend when content is empty', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)
    fireEvent.click(screen.getByText('전송'))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('toggles mode to 일반 질문', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)

    fireEvent.click(screen.getByText('일반 질문'))
    const textarea = screen.getByPlaceholderText(/메시지를 입력하세요/)
    fireEvent.change(textarea, { target: { value: '테스트' } })
    fireEvent.click(screen.getByText('전송'))

    expect(onSend).toHaveBeenCalledWith('테스트', 'objective')
  })

  it('disables input and button when disabled prop is true', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} disabled />)

    expect(screen.getByPlaceholderText(/메시지를 입력하세요/)).toBeDisabled()
    expect(screen.getByText('전송')).toBeDisabled()
  })

  it('clears input after send', () => {
    const onSend = jest.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/메시지를 입력하세요/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '전송 후 클리어' } })
    fireEvent.click(screen.getByText('전송'))

    expect(textarea.value).toBe('')
  })
})
