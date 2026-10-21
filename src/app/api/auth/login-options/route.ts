import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { findUserByUsername, saveUser } from '@/lib/db';
import { getRelyingPartyConfig } from '@/lib/webauthn-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username } = body;

    const { rpID } = getRelyingPartyConfig(req);

    let allowCredentials = undefined;
    let user = null;

    if (username && typeof username === 'string') {
      user = await findUserByUsername(username);
      if (!user) {
        return NextResponse.json(
          { error: `Không tìm thấy tài khoản "${username}". Vui lòng đăng ký trước.` },
          { status: 404 }
        );
      }

      if (user.credentials.length === 0) {
        return NextResponse.json(
          { error: `Tài khoản "${username}" chưa có khóa bảo mật FIDO2 nào được liên kết.` },
          { status: 400 }
        );
      }

      allowCredentials = user.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports as any,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    if (user) {
      user.currentChallenge = options.challenge;
      await saveUser(user);
    }

    const res = NextResponse.json({
      options,
      hasUser: !!user,
      username: user?.username,
    });

    // Store challenge in temporary cookie to support discoverable resident credentials
    res.cookies.set('nt101_auth_challenge', options.challenge, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300, // 5 minutes
    });

    return res;
  } catch (error: any) {
    console.error('Login options error:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi khi tạo yêu cầu xác thực FIDO2' },
      { status: 500 }
    );
  }
}
