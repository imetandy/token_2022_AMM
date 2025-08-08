export type Commitment = 'processed' | 'confirmed' | 'finalized'

export async function waitForConfirmation(
  connection: any,
  signature: string,
  timeoutMs: number = 60_000,
  commitment: Commitment = 'confirmed'
): Promise<{ value: { err: any; confirmationStatus?: string | null } }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await connection.getSignatureStatuses([signature])
    const status = res?.value?.[0]
    if (status) {
      if (status.err) return { value: { err: status.err, confirmationStatus: status.confirmationStatus ?? null } }
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return { value: { err: null, confirmationStatus: status.confirmationStatus ?? null } }
      }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  // Timeout: return no error but no confirmation; caller can treat as not confirmed
  return { value: { err: new Error('Timeout waiting for confirmation'), confirmationStatus: null } }
}

