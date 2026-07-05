import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { loadAgentPerformance } from '@/lib/agent-analytics/queries'

export async function GET(request: NextRequest) {
  try {
    await getCurrentAccount()

    const { searchParams } = new URL(request.url)
    const range = Math.min(90, Math.max(1, Number(searchParams.get('range')) || 30))

    const admin = supabaseAdmin()
    const result = await loadAgentPerformance(admin, range)

    return NextResponse.json(result)
  } catch (err) {
    return toErrorResponse(err)
  }
}
