import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { findUserByUsername, findUserByCredentialId, saveUser, addCryptoAuditLog } from '@/lib/db';
import { getRelyingPartyConfig } from '@/lib/webauthn-config';
import {
  base64UrlToUint8Array,
  uint8ArrayToHex,
  parseClientDataJSON,
  parseAuthenticatorData,
} from '@/lib/crypto-utils';
import { User } from '@/lib/types';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, response } = body;

    if (!response || !response.id) {
      return NextResponse.json({ error: 'Thiếu dữ liệu chữ ký xác thực FIDO2' }, { status: 400 });
    }

    const { rpID, origin } = getRelyingPartyConfig(req);

    // Retrieve expected challenge
    const cookieChallenge = req.cookies.get('nt101_auth_challenge')?.value;
    let expectedChallenge = cookieChallenge;

    // Find the user and credential
    let userAndCred = await findUserByCredentialId(response.id);
    let user: User | null = userAndCred ? userAndCred.user : null;
    let credential = userAndCred?.credential;

    if (!user && username) {
      user = await findUserByUsername(username);
      if (user) {
        credential = user.credentials.find((c: any) => c.id === response.id);
      }
    }

    if (!user || !credential) {
      return NextResponse.json(
        { error: 'Không tìm thấy thông tin khóa bảo mật đã đăng ký trên hệ thống' },
        { status: 404 }
      );
    }

    if (!expectedChallenge && user.currentChallenge) {
      expectedChallenge = user.currentChallenge;
    }

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Thử thách xác thực (Challenge) đã hết hạn. Vui lòng thử lại.' },
        { status: 400 }
      );
    }

    const clientDataParsed = parseClientDataJSON(response.response?.clientDataJSON);
    const authDataParsed = parseAuthenticatorData(response.response?.authenticatorData);
    let signatureHex = '';
    if (response.response?.signature) {
      try {
        const sigBytes = base64UrlToUint8Array(response.response.signature);
        signatureHex = uint8ArrayToHex(sigBytes);
      } catch {
        signatureHex = response.response.signature;
      }
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.id,
          publicKey: base64UrlToUint8Array(credential.publicKey) as any,
          counter: credential.counter,
          transports: credential.transports as any,
        },
        requireUserVerification: false,
      });
    } catch (verifErr: any) {
      await addCryptoAuditLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        username: user.username,
        action: 'AUTHENTICATION',
        status: 'FAILED',
        rpId: rpID,
        origin,
        challenge: expectedChallenge,
        credentialId: credential.id,
        signatureHex,
        errorMessage: verifErr.message || 'Xác minh chữ ký số thất bại',
        clientData: clientDataParsed,
        authenticatorData: authDataParsed,
      });

      return NextResponse.json(
        { error: `Chữ ký mật mã không hợp lệ: ${verifErr.message}` },
        { status: 401 }
      );
    }

    const { verified, authenticationInfo } = verification;

    if (!verified || !authenticationInfo) {
      return NextResponse.json({ error: 'Xác thực FIDO2 không thành công' }, { status: 401 });
    }

    const previousCounter = credential.counter;
    credential.counter = authenticationInfo.newCounter;
    credential.lastUsedAt = new Date().toISOString();
    user.currentChallenge = undefined;
    await saveUser(user);

    // Raw data for cryptographic inspection & tampering verification
    let rawAuthDataHex = '';
    let rawClientDataJSON = '';
    try {
      if (response.response?.authenticatorData) {
        rawAuthDataHex = uint8ArrayToHex(base64UrlToUint8Array(response.response.authenticatorData));
      }
      if (response.response?.clientDataJSON) {
        rawClientDataJSON = new TextDecoder('utf-8').decode(base64UrlToUint8Array(response.response.clientDataJSON));
      }
    } catch (e) {
      console.error('Error decoding raw crypto fields:', e);
    }

    // Save success audit log
    const auditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      username: user.username,
      action: 'AUTHENTICATION' as const,
      status: 'SUCCESS' as const,
      rpId: rpID,
      origin,
      challenge: expectedChallenge,
      credentialId: credential.id,
      algorithmName: credential.algorithmName,
      publicKeyHex: credential.publicKeyHex,
      publicKeyPem: credential.publicKeyPem,
      signatureHex,
      rawAuthDataHex,
      rawClientDataJSON,
      clientData: clientDataParsed,
      authenticatorData: authDataParsed,
      details: `Xác thực thành công qua Public-Key Cryptography. SignCounter tăng từ ${previousCounter} lên ${authenticationInfo.newCounter}`,
    };
    await addCryptoAuditLog(auditLog);

    const res = NextResponse.json({
      verified: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        credentialsCount: user.credentials.length,
      },
      auditLog,
    });

    res.cookies.set('nt101_session', JSON.stringify({ userId: user.id, username: user.username }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    res.cookies.delete('nt101_auth_challenge');

    return res;
  } catch (error: any) {
    console.error('Login verify error:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi khi xử lý xác thực FIDO2' },
      { status: 500 }
    );
  }
}
