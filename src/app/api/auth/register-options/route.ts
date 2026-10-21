import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { findUserByUsername, saveUser } from '@/lib/db';
import { getRelyingPartyConfig } from '@/lib/webauthn-config';
import { User } from '@/lib/types';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, displayName, authenticatorAttachment } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Tên người dùng là bắt buộc' }, { status: 400 });
    }

    const { rpName, rpID } = getRelyingPartyConfig(req);

    let user = await findUserByUsername(username);
    if (!user) {
      // Create new user profile
      user = {
        id: crypto.randomUUID(),
        username: username.trim(),
        displayName: (displayName || username).trim(),
        createdAt: new Date().toISOString(),
        credentials: [],
      };
    }

    const authenticatorSelection: AuthenticatorSelectionCriteria = {
      residentKey: 'preferred',
      userVerification: 'preferred',
    };

    if (authenticatorAttachment === 'platform') {
      authenticatorSelection.authenticatorAttachment = 'platform';
    } else if (authenticatorAttachment === 'cross-platform') {
      authenticatorSelection.authenticatorAttachment = 'cross-platform';
    }

    const excludeCredentials = user.credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports as any,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      userDisplayName: user.displayName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection,
      supportedAlgorithmIDs: [-7, -257, -8, -37], // ES256, RS256, Ed25519, PS256
    });

    // Save challenge to user
    user.currentChallenge = options.challenge;
    await saveUser(user);

    return NextResponse.json({
      options,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error: any) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi khi tạo tùy chọn đăng ký FIDO2' },
      { status: 500 }
    );
  }
}
