import { NextRequest, NextResponse } from 'next/server';
import { findUserById } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('nt101_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    let parsed;
    try {
      parsed = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = await findUserById(parsed.userId);
    if (!user) {
      const res = NextResponse.json({ authenticated: false, user: null });
      res.cookies.delete('nt101_session');
      return res;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt,
        credentials: user.credentials.map((c) => ({
          id: c.id,
          deviceName: c.deviceName,
          createdAt: c.createdAt,
          lastUsedAt: c.lastUsedAt,
          counter: c.counter,
          deviceType: c.deviceType,
          backedUp: c.backedUp,
          algorithmName: c.algorithmName,
          publicKeyHex: c.publicKeyHex,
          publicKeyPem: c.publicKeyPem,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error?.message });
  }
}
