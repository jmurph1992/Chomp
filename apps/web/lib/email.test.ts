import { describe, it, expect, vi, beforeEach } from 'vitest'

const send = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send } })),
}))

const { sendEmail } = await import('./email')

beforeEach(() => {
  send.mockReset()
  process.env.RESEND_API_KEY = 'key123'
  process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev'
})

describe('sendEmail', () => {
  it('sends with the given to/subject/html and the configured from address', async () => {
    send.mockResolvedValue({ data: { id: 'email123' }, error: null })

    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })

    expect(send).toHaveBeenCalledWith({
      from: 'onboarding@resend.dev',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })
  })

  it('throws a real Error when Resend returns an error', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'invalid recipient' } })

    await expect(sendEmail({ to: 'bad', subject: 'Hello', html: '<p>Hi</p>' })).rejects.toThrow(
      'invalid recipient',
    )
  })
})
