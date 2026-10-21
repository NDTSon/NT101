import { NextRequest, NextResponse } from 'next/server';
import { getCryptoAuditLogs } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const logs = await getCryptoAuditLogs(limit);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi khi tải audit logs' }, { status: 500 });
  }
}
