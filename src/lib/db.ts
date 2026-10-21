import fs from 'fs/promises';
import path from 'path';
import { User, CryptoAuditLog, PasskeyCredential } from './types';

interface DatabaseSchema {
  users: User[];
  logs: CryptoAuditLog[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

let memoryDb: DatabaseSchema | null = null;

async function ensureDbInitialized(): Promise<DatabaseSchema> {
  if (memoryDb) {
    return memoryDb;
  }

  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const content = await fs.readFile(DB_FILE, 'utf-8');
    memoryDb = JSON.parse(content);
    return memoryDb!;
  } catch {
    // Initialize default db
    const initial: DatabaseSchema = {
      users: [],
      logs: [],
    };
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write initial DB file, continuing in memory:', err);
    }
    memoryDb = initial;
    return memoryDb;
  }
}

async function persistDb(): Promise<void> {
  if (!memoryDb) return;
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error persisting database:', err);
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await ensureDbInitialized();
  const normalized = username.trim().toLowerCase();
  return db.users.find((u) => u.username.toLowerCase() === normalized) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await ensureDbInitialized();
  return db.users.find((u) => u.id === id) || null;
}

export async function findUserByCredentialId(credentialId: string): Promise<{ user: User; credential: PasskeyCredential } | null> {
  const db = await ensureDbInitialized();
  for (const user of db.users) {
    const cred = user.credentials.find((c) => c.id === credentialId);
    if (cred) {
      return { user, credential: cred };
    }
  }
  return null;
}

export async function saveUser(user: User): Promise<void> {
  const db = await ensureDbInitialized();
  const idx = db.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    db.users[idx] = user;
  } else {
    db.users.push(user);
  }
  await persistDb();
}

export async function deletePasskey(userId: string, credentialId: string): Promise<boolean> {
  const db = await ensureDbInitialized();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return false;

  const initialCount = user.credentials.length;
  user.credentials = user.credentials.filter((c) => c.id !== credentialId);
  if (user.credentials.length !== initialCount) {
    await persistDb();
    return true;
  }
  return false;
}

export async function addCryptoAuditLog(log: CryptoAuditLog): Promise<void> {
  const db = await ensureDbInitialized();
  // Keep latest 150 logs
  db.logs.unshift(log);
  if (db.logs.length > 150) {
    db.logs = db.logs.slice(0, 150);
  }
  await persistDb();
}

export async function getCryptoAuditLogs(limit = 50): Promise<CryptoAuditLog[]> {
  const db = await ensureDbInitialized();
  return db.logs.slice(0, limit);
}

export async function deleteUser(userId: string): Promise<boolean> {
  const db = await ensureDbInitialized();
  const initialLen = db.users.length;
  db.users = db.users.filter((u) => u.id !== userId);
  if (db.users.length !== initialLen) {
    await persistDb();
    return true;
  }
  return false;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<boolean> {
  const db = await ensureDbInitialized();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return false;
  user.displayName = displayName;
  await persistDb();
  return true;
}

export async function getAllUsers(): Promise<User[]> {
  const db = await ensureDbInitialized();
  return db.users;
}

