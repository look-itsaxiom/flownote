import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginButton } from './LoginButton'

describe('LoginButton', () => {
  it('renders both Google and GitHub provider options', () => {
    const mockLoginGoogle = vi.fn()
    const mockLoginGithub = vi.fn()

    render(
      <LoginButton
        onLoginGoogle={mockLoginGoogle}
        onLoginGithub={mockLoginGithub}
      />
    )

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument()
  })

  it('calls onLoginGoogle when Google button is clicked', () => {
    const mockLoginGoogle = vi.fn()
    const mockLoginGithub = vi.fn()

    render(
      <LoginButton
        onLoginGoogle={mockLoginGoogle}
        onLoginGithub={mockLoginGithub}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /google/i }))

    expect(mockLoginGoogle).toHaveBeenCalledTimes(1)
    expect(mockLoginGithub).not.toHaveBeenCalled()
  })

  it('calls onLoginGithub when GitHub button is clicked', () => {
    const mockLoginGoogle = vi.fn()
    const mockLoginGithub = vi.fn()

    render(
      <LoginButton
        onLoginGoogle={mockLoginGoogle}
        onLoginGithub={mockLoginGithub}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /github/i }))

    expect(mockLoginGithub).toHaveBeenCalledTimes(1)
    expect(mockLoginGoogle).not.toHaveBeenCalled()
  })

  it('disables buttons when loading is true', () => {
    const mockLoginGoogle = vi.fn()
    const mockLoginGithub = vi.fn()

    render(
      <LoginButton
        onLoginGoogle={mockLoginGoogle}
        onLoginGithub={mockLoginGithub}
        loading={true}
      />
    )

    expect(screen.getByRole('button', { name: /google/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /github/i })).toBeDisabled()
  })

  it('buttons are enabled by default', () => {
    const mockLoginGoogle = vi.fn()
    const mockLoginGithub = vi.fn()

    render(
      <LoginButton
        onLoginGoogle={mockLoginGoogle}
        onLoginGithub={mockLoginGithub}
      />
    )

    expect(screen.getByRole('button', { name: /google/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /github/i })).not.toBeDisabled()
  })
})
