export interface PasskeyCredential {
  id: string; // Base64URL credential ID
  publicKey: string; // Base64URL encoded public key
  counter: number;
  transports?: string[];
  deviceType?: string;
  backedUp?: boolean;
  deviceName: string;
  createdAt: string;
  lastUsedAt?: string;
  algorithm: number;
  algorithmName: string;
  publicKeyHex?: string;
  publicKeyPem?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  currentChallenge?: string;
  createdAt: string;
  credentials: PasskeyCredential[];
}

export interface AuthenticatorFlags {
  userPresent: boolean;
  userVerified: boolean;
  attestedCredentialData: boolean;
  extensionDataIncluded: boolean;
  rawFlagsByte: number;
}

export interface ClientDataParsed {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

export interface AuthenticatorDataParsed {
  rpIdHashHex: string;
  flags: AuthenticatorFlags;
  counter: number;
  aaguidHex?: string;
}

export interface CryptoAuditLog {
  id: string;
  timestamp: string;
  username: string;
  action: 'REGISTRATION' | 'AUTHENTICATION';
  status: 'SUCCESS' | 'FAILED';
  rpId: string;
  origin: string;
  challenge: string;
  clientData?: ClientDataParsed;
  authenticatorData?: AuthenticatorDataParsed;
  credentialId?: string;
  algorithmName?: string;
  publicKeyHex?: string;
  publicKeyPem?: string;
  signatureHex?: string;
  rawAuthDataHex?: string;
  rawClientDataJSON?: string;
  errorMessage?: string;
  details?: string;
}
