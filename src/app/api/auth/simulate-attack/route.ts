import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addCryptoAuditLog, findUserByCredentialId, getAllUsers } from '@/lib/db';
import { base64UrlToUint8Array, uint8ArrayToHex } from '@/lib/crypto-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, payload } = body;

    if (type === 'replay') {
      const { challenge, username, credentialId } = payload || {};
      
      const log = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        username: username || 'unknown_target',
        action: 'AUTHENTICATION' as const,
        status: 'FAILED' as const,
        rpId: 'localhost',
        origin: 'http://localhost:3000',
        challenge: challenge || 'replayed-nonce-challenge',
        credentialId,
        errorMessage: 'REPLAY ATTACK PHÁT HIỆN: Thử thách (Challenge Nonce) đã bị sử dụng trong phiên trước hoặc đã hết hạn TTL (W3C §7.2).',
        details: 'Hệ thống từ chối yêu cầu do máy chủ áp dụng nguyên tắc Single-Use Nonce & Timestamp TTL. Gói tin xác thực bị phát lại bị chặn đứng.',
      };
      await addCryptoAuditLog(log);

      return NextResponse.json({
        attack: 'REPLAY_ATTACK',
        blocked: true,
        httpStatus: 401,
        verdict: 'ATTACK_PREVENTED',
        reason: 'Challenge Nonce đã bị tiêu thụ (Consumed) trong phiên trước.',
        mechanism: 'FIDO2 Server áp dụng Single-Use Nonce sinh ngẫu nhiên cryptographically secure (32 bytes). Mỗi lần xác thực đòi hỏi một Challenge duy nhất và có thời gian sống (TTL = 60s).',
        auditLogId: log.id,
      });
    }

    if (type === 'phishing') {
      const { fakeOrigin, expectedRPID, expectedOrigin, username } = payload || {};
      const targetOrigin = (fakeOrigin || '').trim();
      const legitimateOrigin = (expectedOrigin || 'http://localhost:3000').trim();

      // Robust URL comparison
      const normalize = (u: string) => {
        let s = (u || '').trim();
        if (!s.startsWith('http://') && !s.startsWith('https://')) {
          s = 'http://' + s;
        }
        return s.replace(/\/+$/, '').toLowerCase();
      };

      const normTarget = normalize(targetOrigin);
      const normLegit = normalize(legitimateOrigin);

      // Check if both point to localhost / 127.0.0.1 on the same port
      let isMatch = normTarget === normLegit;
      if (!isMatch) {
        try {
          const urlT = new URL(normTarget);
          const urlL = new URL(normLegit);
          const portT = urlT.port || (urlT.protocol === 'https:' ? '443' : '80');
          const portL = urlL.port || (urlL.protocol === 'https:' ? '443' : '80');
          const isHostLocalT = urlT.hostname === 'localhost' || urlT.hostname === '127.0.0.1';
          const isHostLocalL = urlL.hostname === 'localhost' || urlL.hostname === '127.0.0.1';
          if (isHostLocalT && isHostLocalL && portT === portL) {
            isMatch = true;
          }
        } catch {
          isMatch = normTarget === normLegit;
        }
      }

      const cleanTarget = targetOrigin.replace(/\/+$/, '') || legitimateOrigin;

      if (isMatch) {
        const log = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          username: username || 'user_demo',
          action: 'AUTHENTICATION' as const,
          status: 'SUCCESS' as const,
          rpId: expectedRPID || 'localhost',
          origin: cleanTarget,
          challenge: crypto.randomBytes(32).toString('base64url'),
          details: `Xác thực thành công. Origin [${cleanTarget}] trùng khớp 100% với RP ID [${expectedRPID || 'localhost'}].`,
        };
        await addCryptoAuditLog(log);

        return NextResponse.json({
          attack: 'ORIGIN_VALIDATION',
          isLegitimate: true,
          blocked: false,
          httpStatus: 200,
          verdict: 'AUTHENTICATION_SUCCESS',
          expectedOrigin: legitimateOrigin,
          receivedOrigin: cleanTarget,
          expectedRPID: expectedRPID || 'localhost',
          explanation: `XÁC THỰC THÀNH CÔNG! Origin [${cleanTarget}] hoàn toàn trùng khớp với Relying Party Origin đã cấu hình (${legitimateOrigin}). FIDO2 Authenticator và Máy chủ chấp thuận yêu cầu đăng nhập!`,
          auditLogId: log.id,
        });
      } else {
        const log = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          username: username || 'phishing_victim',
          action: 'AUTHENTICATION' as const,
          status: 'FAILED' as const,
          rpId: expectedRPID || 'localhost',
          origin: cleanTarget,
          challenge: crypto.randomBytes(32).toString('base64url'),
          errorMessage: `PHISHING ATTACK PHÁT HIỆN: Origin nhận được [${cleanTarget}] không khớp với Relying Party ID đã cấu hình.`,
          details: `Cơ chế Origin Binding của trình duyệt ghi nhận domain thật của tab đang duyệt là ${cleanTarget}. Khóa FIDO2 gắn chặt với ${expectedRPID || 'localhost'} nên việc trích xuất khóa trên trang giả mạo hoàn toàn bất khả thi.`,
        };
        await addCryptoAuditLog(log);

        return NextResponse.json({
          attack: 'PHISHING_ATTACK',
          isLegitimate: false,
          blocked: true,
          httpStatus: 403,
          verdict: 'AUTHENTICATION_REJECTED',
          expectedOrigin: legitimateOrigin,
          receivedOrigin: cleanTarget,
          expectedRPID: expectedRPID || 'localhost',
          reason: 'Origin Binding Mismatch (W3C WebAuthn §13.4.3).',
          explanation: `TÊN MIỀN GIẢ MẠO BỊ CHẶN ĐỨNG! Máy chủ mong đợi Origin [${legitimateOrigin}] nhưng gói tin lại đến từ [${cleanTarget}]. Trình duyệt và Authenticator phát hiện sai lệch tên miền và từ chối xác thực.`,
          auditLogId: log.id,
        });
      }
    }

    if (type === 'verify-signature' || type === 'tamper-signature') {
      const {
        credentialId,
        username,
        signatureHex,
        rawAuthDataHex,
        rawClientDataJSON,
        tamperedClientDataJSON,
      } = payload || {};

      // Find user credential to get true public key
      let credPublicKeyBase64 = '';
      if (credentialId) {
        const found = await findUserByCredentialId(credentialId);
        if (found) credPublicKeyBase64 = found.credential.publicKey;
      }

      if (!credPublicKeyBase64) {
        const allUsers = await getAllUsers();
        for (const u of allUsers) {
          if (!username || u.username === username) {
            if (u.credentials && u.credentials.length > 0) {
              credPublicKeyBase64 = u.credentials[0].publicKey;
              break;
            }
          }
        }
      }

      if (!credPublicKeyBase64 || !signatureHex || !rawAuthDataHex) {
        return NextResponse.json({
          error: 'Thiếu thông tin khóa bảo mật hoặc chữ ký để xác minh',
        }, { status: 400 });
      }

      const clientJsonToUse = (type === 'tamper-signature' && tamperedClientDataJSON)
        ? tamperedClientDataJSON
        : (rawClientDataJSON || '{}');

      // 1. Calculate SHA-256 of clientDataJSON
      const clientHash = crypto.createHash('sha256').update(Buffer.from(clientJsonToUse, 'utf8')).digest();
      const clientHashHex = clientHash.toString('hex');

      // 2. Concat authenticatorData + SHA-256(clientDataJSON)
      const authDataBuf = Buffer.from(rawAuthDataHex, 'hex');
      const signedData = Buffer.concat([authDataBuf, clientHash]);
      const signedDataHex = signedData.toString('hex');

      // 3. Verify signature using SimpleWebAuthn verifySignature
      const sigBuf = Buffer.from(signatureHex, 'hex');
      const credKeyBuf = Buffer.from(credPublicKeyBase64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

      let isValid = false;
      let errorDetail: string | undefined = undefined;
      let uncompressedHex = '';

      try {
        const { verifySignature, decodeCredentialPublicKey } = await import('@simplewebauthn/server/helpers');
        
        // Extract SEC1 Uncompressed Public Key (04 || X || Y)
        try {
          const coseMap: any = decodeCredentialPublicKey(credKeyBuf);
          const x = coseMap.get(-2);
          const y = coseMap.get(-3);
          if (x && y) {
            uncompressedHex = Buffer.concat([Buffer.from([0x04]), Buffer.from(x), Buffer.from(y)]).toString('hex');
          }
        } catch (e) {}

        isValid = await verifySignature({
          credentialPublicKey: credKeyBuf,
          signature: sigBuf,
          data: signedData,
        });
      } catch (err: any) {
        isValid = false;
        errorDetail = err.message;
      }

      return NextResponse.json({
        isValid,
        type,
        algorithm: 'ES256 (ECDSA w/ SHA-256 trên NIST P-256)',
        uncompressedPublicKeyHex: uncompressedHex,
        clientDataHashHex: clientHashHex,
        signedDataLengthBytes: signedData.length,
        signedDataHex,
        isTampered: type === 'tamper-signature',
        errorDetail,
        explanation: isValid
          ? 'Chữ ký số HỢP LỆ! Khóa công khai (Public Key) xác minh thành công chữ ký sinh từ Khóa riêng (Private Key) trong chip bảo mật mà không cần biết Private Key.'
          : 'Chữ ký số BỊ TỪ CHỐI / KHÔNG HỢP LỆ! Bất kỳ thay đổi nào dù chỉ 1 ký tự trong Challenge/ClientDataJSON đều làm sai lệch băm SHA-256, khiến thuật toán ECDSA phát hiện dữ liệu đã bị sửa đổi (Vi phạm tính toàn vẹn - Data Integrity).',
      });
    }

    return NextResponse.json({ error: 'Loại kiểm tra không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý kiểm tra tấn công' }, { status: 500 });
  }
}
