import { AuthenticatorFlags, ClientDataParsed, AuthenticatorDataParsed } from './types';

export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseClientDataJSON(clientDataJSONBase64: string): ClientDataParsed | undefined {
  try {
    const bytes = base64UrlToUint8Array(clientDataJSONBase64);
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(jsonStr);
    return {
      type: parsed.type,
      challenge: parsed.challenge,
      origin: parsed.origin,
      crossOrigin: parsed.crossOrigin,
    };
  } catch {
    return undefined;
  }
}

export function parseAuthenticatorData(authDataBase64: string): AuthenticatorDataParsed | undefined {
  try {
    const bytes = base64UrlToUint8Array(authDataBase64);
    if (bytes.length < 37) return undefined;

    // RP ID Hash (bytes 0-31)
    const rpIdHash = bytes.slice(0, 32);
    const rpIdHashHex = uint8ArrayToHex(rpIdHash);

    // Flags byte (byte 32)
    const flagsByte = bytes[32];
    const flags: AuthenticatorFlags = {
      userPresent: (flagsByte & 0x01) !== 0,
      userVerified: (flagsByte & 0x04) !== 0,
      attestedCredentialData: (flagsByte & 0x40) !== 0,
      extensionDataIncluded: (flagsByte & 0x80) !== 0,
      rawFlagsByte: flagsByte,
    };

    // Sign Counter (bytes 33-36, big-endian 32-bit int)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const counter = view.getUint32(33, false);

    let aaguidHex: string | undefined = undefined;
    if (flags.attestedCredentialData && bytes.length >= 53) {
      const aaguid = bytes.slice(37, 53);
      aaguidHex = uint8ArrayToHex(aaguid);
    }

    return {
      rpIdHashHex,
      flags,
      counter,
      aaguidHex,
    };
  } catch {
    return undefined;
  }
}

export function getAlgorithmName(algId: number): string {
  switch (algId) {
    case -7:
      return 'ES256 (ECDSA w/ SHA-256 trên đường cong NIST P-256)';
    case -257:
      return 'RS256 (RSASSA-PKCS1-v1_5 w/ SHA-256, 2048-bit)';
    case -8:
      return 'Ed25519 (EdDSA w/ Curve25519)';
    case -37:
      return 'PS256 (RSASSA-PSS w/ SHA-256)';
    case -38:
      return 'PS384 (RSASSA-PSS w/ SHA-384)';
    case -39:
      return 'PS512 (RSASSA-PSS w/ SHA-512)';
    default:
      return `COSE Algorithm ID ${algId}`;
  }
}

export function formatAsPem(base64Spki: string, type: 'PUBLIC KEY' | 'CERTIFICATE' = 'PUBLIC KEY'): string {
  const clean = base64Spki.replace(/\s+/g, '');
  const chunks = clean.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}
