import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { findUserByUsername, saveUser, addCryptoAuditLog } from '@/lib/db';
import { getRelyingPartyConfig } from '@/lib/webauthn-config';
import {
  uint8ArrayToBase64Url,
  uint8ArrayToHex,
  base64UrlToUint8Array,
  parseClientDataJSON,
  parseAuthenticatorData,
  getAlgorithmName,
  formatAsPem,
} from '@/lib/crypto-utils';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, response, deviceName } = body;

    if (!username || !response) {
      return NextResponse.json({ error: 'Thiếu thông tin xác minh' }, { status: 400 });
    }

    const user = await findUserByUsername(username);
    if (!user || !user.currentChallenge) {
      return NextResponse.json(
        { error: 'Không tìm thấy phiên đăng ký hợp lệ hoặc challenge đã hết hạn' },
        { status: 400 }
      );
    }

    const { rpID, origin } = getRelyingPartyConfig(req);
    const expectedChallenge = user.currentChallenge;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (verifErr: any) {
      // Log failed attempt
      await addCryptoAuditLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        username: user.username,
        action: 'REGISTRATION',
        status: 'FAILED',
        rpId: rpID,
        origin,
        challenge: expectedChallenge,
        errorMessage: verifErr.message || 'Xác minh thất bại',
        clientData: parseClientDataJSON(response.response?.clientDataJSON),
        authenticatorData: parseAuthenticatorData(response.response?.authenticatorData),
      });

      return NextResponse.json(
        { error: `Xác minh FIDO2 không thành công: ${verifErr.message}` },
        { status: 400 }
      );
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return NextResponse.json({ error: 'Xác minh thông tin đăng ký không hợp lệ' }, { status: 400 });
    }

    const { credential, credentialType } = registrationInfo;
    const publicKeyBytes = credential.publicKey;
    const publicKeyBase64Url = uint8ArrayToBase64Url(publicKeyBytes);
    const publicKeyHex = uint8ArrayToHex(publicKeyBytes);
    const clientDataParsed = parseClientDataJSON(response.response?.clientDataJSON);
    const authDataParsed = parseAuthenticatorData(response.response?.authenticatorData);

    // Convert raw public key to SPKI / PEM format if possible
    let publicKeyPem = '';
    let algorithmName = 'ES256 (ECDSA P-256)';
    try {
      const spkiBuf = Buffer.from(publicKeyBytes);
      publicKeyPem = formatAsPem(spkiBuf.toString('base64'));
    } catch {
      publicKeyPem = `// COSE Raw Key (Hex):\n${publicKeyHex}`;
    }

    const newPasskey = {
      id: credential.id,
      publicKey: publicKeyBase64Url,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: (registrationInfo as any).credentialDeviceType,
      backedUp: (registrationInfo as any).credentialBackedUp,
      deviceName: deviceName || (authDataParsed?.flags.userVerified ? 'Windows Hello / Sinh trắc học' : 'FIDO2 Security Key'),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      algorithm: -7,
      algorithmName,
      publicKeyHex,
      publicKeyPem,
    };

    user.credentials.push(newPasskey);
    user.currentChallenge = undefined;
    await saveUser(user);

    // Raw data for cryptographic inspection
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
      action: 'REGISTRATION' as const,
      status: 'SUCCESS' as const,
      rpId: rpID,
      origin,
      challenge: expectedChallenge,
      credentialId: credential.id,
      algorithmName,
      publicKeyHex,
      publicKeyPem,
      rawAuthDataHex,
      rawClientDataJSON,
      clientData: clientDataParsed,
      authenticatorData: authDataParsed,
      details: `Đăng ký thành công khóa FIDO2. SignCount=${credential.counter}`,
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

    // Set user session cookie
    res.cookies.set('nt101_session', JSON.stringify({ userId: user.id, username: user.username }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (error: any) {
    console.error('Registration verify error:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi khi hoàn tất xác minh đăng ký' },
      { status: 500 }
    );
  }
}
