import { describe, it, expect, vi, beforeEach } from 'vitest'

const truckOperatorFindMany = vi.fn()

vi.mock('@chomp/db', () => ({
  db: { truckOperator: { findMany: truckOperatorFindMany } },
}))

const { getOperatorEmails, verificationDecisionEmailHtml } = await import('./verification-notifications')

beforeEach(() => {
  truckOperatorFindMany.mockReset()
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('getOperatorEmails', () => {
  it('queries every operator with no role filter — owner and managers alike', async () => {
    truckOperatorFindMany.mockResolvedValue([])
    await getOperatorEmails('t1')

    expect(truckOperatorFindMany).toHaveBeenCalledWith({
      where: { truckId: 't1' },
      include: { user: { select: { email: true } } },
    })
  })

  it('flattens the result to a plain email array', async () => {
    truckOperatorFindMany.mockResolvedValue([
      { user: { email: 'owner@example.com' } },
      { user: { email: 'manager@example.com' } },
    ])
    expect(await getOperatorEmails('t1')).toEqual(['owner@example.com', 'manager@example.com'])
  })
})

describe('verificationDecisionEmailHtml', () => {
  const truck = { name: 'Taco Kings', slug: 'taco-kings' }

  it('verified links to the public truck page', () => {
    const html = verificationDecisionEmailHtml('t1', truck, 'verified', null)
    expect(html).toContain('Taco Kings')
    expect(html).toContain('http://localhost:3000/trucks/taco-kings')
    expect(html).not.toContain('/dashboard')
  })

  it('rejected includes the reason and links to the dashboard, not the (404ing) public page', () => {
    const html = verificationDecisionEmailHtml('t1', truck, 'rejected', 'Fake business')
    expect(html).toContain('was not approved')
    expect(html).toContain('Fake business')
    expect(html).toContain('http://localhost:3000/dashboard/t1')
    expect(html).not.toContain('/trucks/taco-kings')
  })

  it('onHold includes the reason and links to the dashboard', () => {
    const html = verificationDecisionEmailHtml('t1', truck, 'onHold', 'Health code complaint')
    expect(html).toContain('has been put on hold')
    expect(html).toContain('Health code complaint')
    expect(html).toContain('http://localhost:3000/dashboard/t1')
  })

  it('omits the reason paragraph entirely when note is null', () => {
    const html = verificationDecisionEmailHtml('t1', truck, 'onHold', null)
    expect(html).not.toContain('Reason:')
  })
})
