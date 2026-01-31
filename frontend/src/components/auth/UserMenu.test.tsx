import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserMenu } from './UserMenu'

const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
}

describe('UserMenu', () => {
  it('shows user avatar', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    const avatar = screen.getByRole('img', { name: /avatar/i })
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('src', mockUser.photoURL)
  })

  it('shows user display name', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText(mockUser.displayName!)).toBeInTheDocument()
  })

  it('shows user email when no display name', () => {
    const userWithoutName = { ...mockUser, displayName: null }

    render(
      <UserMenu
        user={userWithoutName}
        onLogout={vi.fn()}
      />
    )

    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText(mockUser.email!)).toBeInTheDocument()
  })

  it('shows fallback avatar when no photoURL', () => {
    const userWithoutPhoto = { ...mockUser, photoURL: null }

    render(
      <UserMenu
        user={userWithoutPhoto}
        onLogout={vi.fn()}
      />
    )

    // Should show initials or default avatar
    const avatarButton = screen.getByRole('button')
    expect(avatarButton).toBeInTheDocument()
  })

  it('toggles dropdown menu on click', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    // Dropdown should be closed initially
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click again to close
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls onLogout when logout button is clicked', () => {
    const mockLogout = vi.fn()

    render(
      <UserMenu
        user={mockUser}
        onLogout={mockLogout}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))

    // Click logout
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown when logout is clicked', () => {
    const mockLogout = vi.fn()

    render(
      <UserMenu
        user={mockUser}
        onLogout={mockLogout}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click logout
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))

    // Dropdown should be closed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
