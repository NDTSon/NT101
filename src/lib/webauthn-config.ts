import { NextRequest } from 'next/server';

export const RP_NAME = 'NT101 - FIDO2 & WebAuthn Security Lab';

export function getRelyingPartyConfig(req: NextRequest) {
  const hostHeader = req.headers.get('host') || 'localhost:3000';
  const hostname = hostHeader.split(':')[0]; // e.g. "localhost" or "127.0.0.1"

  const protocol = req.headers.get('x-forwarded-proto') || (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https');
  const originHeader = req.headers.get('origin');

  const origin = originHeader || `${protocol}://${hostHeader}`;
  const rpID = hostname;

  return {
    rpName: RP_NAME,
    rpID,
    origin,
  };
}
