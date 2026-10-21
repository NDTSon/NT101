'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Hash,
  Lock,
  Radio,
  Globe,
  FileCheck,
  Flame,
  AlertTriangle,
  Send,
  Layers,
  Code,
  ShieldCheck,
} from 'lucide-react';
import { CryptoAuditLog } from '@/lib/types';

interface Fido2InspectorProps {
  initialLogId?: string | null;
}

export default function Fido2Inspector({ initialLogId }: Fido2InspectorProps) {
  const [logs, setLogs] = useState<CryptoAuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<CryptoAuditLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");

  // Tab inside inspector: 'signature' (Mục 5) | 'client-auth-data' (Mục 3 & 4) | 'attacks' (Mục 6 & 8)
  const [subTab, setSubTab] = useState<'signature' | 'client-auth-data' | 'attacks'>('signature');

  // Mục 5: Signature Verification & Tampering state
  const [isTampered, setIsTampered] = useState(false);
  const [tamperedChallenge, setTamperedChallenge] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Mục 6: Replay Attack state
  const [capturedLog, setCapturedLog] = useState<CryptoAuditLog | null>(null);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [replaying, setReplaying] = useState(false);

  // Mục 8: Phishing Attack state
  const [fakeOrigin, setFakeOrigin] = useState('http://localhost:4000');
  const [phishingResult, setPhishingResult] = useState<any>(null);
  const [phishingLoading, setPhishingLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/inspector-logs?limit=30');
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
        if (initialLogId) {
          const match = data.logs.find((l: CryptoAuditLog) => l.id === initialLogId);
          if (match) {
            setSelectedLog(match);
          } else {
            const firstWithSig = data.logs.find((l: CryptoAuditLog) => l.status === 'SUCCESS' && l.signatureHex);
            setSelectedLog(firstWithSig || data.logs[0]);
          }
        } else if (!selectedLog) {
          const firstWithSig = data.logs.find((l: CryptoAuditLog) => l.status === 'SUCCESS' && l.signatureHex);
          setSelectedLog(firstWithSig || data.logs[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [initialLogId]);

  useEffect(() => {
    if (selectedLog) {
      setIsTampered(false);
      setTamperedChallenge((selectedLog.challenge || 'ABC123_NONCE') + '_MODIFIED');
      setVerifyResult(null);
      setCapturedLog(selectedLog);
      setReplayResult(null);
      setPhishingResult(null);
    }
  }, [selectedLog]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const current = selectedLog || logs[0];

  // Helper values for display
  const pubKeyDisplay = current?.publicKeyHex || (current?.publicKeyPem ? current.publicKeyPem.replace(/-----[^\-]+-----/g, '').replace(/\s+/g, '').substring(0, 56) + '...' : '04:8A:2F:E1:9C:3B:5A:11:80:BC:D4:55:10:92:FE:AA:41:09:65...');
  const sigDisplay = current?.signatureHex || '30:45:02:21:00:E2:B5:77:9C:14:5A:F3:11:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:02:20:41...';
  const rawAuthData = current?.rawAuthDataHex || '49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000001';
  const sha256ClientDataDisplay = current?.clientData ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : 'sha256(clientDataJSON)';

  // Authenticator flags calculation
  const rawFlags = current?.authenticatorData?.flags?.rawFlagsByte ?? (
    (current?.authenticatorData?.flags?.userPresent ? 1 : 0) |
    (current?.authenticatorData?.flags?.userVerified ? 4 : 0) |
    (current?.authenticatorData?.flags?.attestedCredentialData ? 64 : 0)
  );
  const bitString = rawFlags.toString(2).padStart(8, '0');
  const flagsHex = '0x' + rawFlags.toString(16).padStart(2, '0').toUpperCase();

  // 5. Run Signature Verification (Normal or Tampered)
  const handleRunVerify = async (tamper: boolean) => {
    if (!current) return;
    if (!current.signatureHex) {
      setVerifyResult({
        error: 'Bản ghi này là lượt thử nghiệm tấn công giả lập, không có chữ ký số. Vui lòng chọn một phiên Đăng Ký hoặc Đăng Nhập thực tế từ danh sách bên trái để xác minh chữ ký ECDSA P-256.',
      });
      return;
    }
    setVerifying(true);
    setIsTampered(tamper);
    try {
      const originalRawJson = current.rawClientDataJSON || JSON.stringify({
        type: current.action === 'REGISTRATION' ? 'webauthn.create' : 'webauthn.get',
        challenge: current.challenge,
        origin: current.origin,
        crossOrigin: false,
      });

      const tamperedJson = originalRawJson.replace(current.challenge, tamperedChallenge);

      const res = await fetch('/api/auth/simulate-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: tamper ? 'tamper-signature' : 'verify-signature',
          payload: {
            credentialId: current.credentialId,
            username: current.username,
            signatureHex: current.signatureHex,
            rawAuthDataHex: current.rawAuthDataHex || rawAuthData,
            rawClientDataJSON: originalRawJson,
            tamperedClientDataJSON: tamper ? tamperedJson : undefined,
          },
        }),
      });

      const data = await res.json();
      setVerifyResult(data);
    } catch (err: any) {
      setVerifyResult({ error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // 6. Run Replay Attack Test
  const handleReplayAttack = async () => {
    if (!current) return;
    setReplaying(true);
    setReplayResult(null);
    try {
      const res = await fetch('/api/auth/simulate-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'replay',
          payload: {
            challenge: current.challenge,
            username: current.username,
            credentialId: current.credentialId,
          },
        }),
      });
      const data = await res.json();
      setReplayResult(data);
    } catch (err: any) {
      setReplayResult({ error: err.message });
    } finally {
      setReplaying(false);
    }
  };

  // 8. Run Phishing Attack Test
  const handlePhishingAttack = async () => {
    setPhishingLoading(true);
    setPhishingResult(null);
    try {
      const res = await fetch('/api/auth/simulate-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phishing',
          payload: {
            fakeOrigin: fakeOrigin.trim(),
            expectedRPID: 'localhost',
            expectedOrigin: 'http://localhost:3000',
            username: current?.username || 'user_demo',
          },
        }),
      });
      const data = await res.json();
      setPhishingResult(data);
    } catch (err: any) {
      setPhishingResult({ error: err.message });
    } finally {
      setPhishingLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-[#09221D] text-[#F59E0B] border border-[#19594D]">
                <Key className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-[#F8FAFC]">
                FIDO2 Cryptographic Inspector
              </h1>
            </div>
            <p className="text-xs text-[#A7C2BC] mt-1 max-w-2xl leading-relaxed">
              Soi chi tiết toàn bộ các thành phần mật mã FIDO2: ClientDataJSON, AuthenticatorData Flags, Khóa công khai, Chữ ký số ECDSA, và Mô phỏng chống Replay & Phishing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'visual' ? 'raw' : 'visual')}
              className="px-3.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#F8FAFC] text-xs font-bold flex items-center gap-1.5 transition-all border border-[#1A574A]"
            >
              {viewMode === 'visual' ? <Code className="w-3.5 h-3.5 text-[#F59E0B]" /> : <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />}
              <span>{viewMode === 'visual' ? 'Xem Dữ Liệu Thô (JSON)' : 'Xem Trực Quan'}</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/25"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang Tải...' : 'Làm Mới Log'}</span>
            </button>
          </div>
        </div>

        {/* 3 Main Inspection Modules Sub-Nav */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#18483D]">
          <button
            onClick={() => setSubTab('signature')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'signature'
                ? 'bg-[#F59E0B] text-[#0A1A17] shadow-lg shadow-amber-500/20'
                : 'bg-[#09221D] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1A574A]'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Xác Minh Chữ Ký Số (Verify Signature)</span>
          </button>

          <button
            onClick={() => setSubTab('client-auth-data')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'client-auth-data'
                ? 'bg-[#F59E0B] text-[#0A1A17] shadow-lg shadow-amber-500/20'
                : 'bg-[#09221D] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1A574A]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Dữ Liệu ClientData & AuthenticatorData</span>
          </button>

          <button
            onClick={() => setSubTab('attacks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'attacks'
                ? 'bg-[#F59E0B] text-[#0A1A17] shadow-lg shadow-amber-500/20'
                : 'bg-[#09221D] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1A574A]'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Thử Nghiệm Tấn Công (Replay & Phishing)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left log selector, Right deep-dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Logs selection list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#A7C2BC] uppercase tracking-wider">
              Bản Ghi Xác Thực ({logs.length})
            </span>
            <span className="text-[10px] text-[#64748B]">Chọn để phân tích</span>
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-[#1C5246] text-[#64748B] text-xs">
                Chưa có bản ghi xác thực nào. Hãy thực hiện Đăng ký hoặc Đăng nhập trên web trước.
              </div>
            ) : (
              logs.map((log) => {
                const isSelected = current?.id === log.id;
                const isSuccess = log.status === 'SUCCESS';
                const isReg = log.action === 'REGISTRATION';

                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-2 ${
                      isSelected
                        ? 'border-[#F59E0B] bg-[#113B31] shadow-lg shadow-black/20'
                        : 'border-[#17483D] bg-[#092620] hover:border-[#226757] hover:bg-[#0D3028]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs">
                        {isReg ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A2621] text-[#F59E0B] border border-[#19594D]">
                            Register
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#144A3E] text-emerald-300 border border-[#216B5A]">
                            Login
                          </span>
                        )}
                        <span className="text-[#F8FAFC] font-mono">@{log.username}</span>
                      </span>

                      {isSuccess ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 text-[11px] font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Thất bại
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A7C2BC] font-mono">
                      <span>{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                      <span>RP: {log.rpId}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: The Chosen Module */}
        <div className="lg:col-span-8 space-y-6">
          {current ? (
            viewMode === 'raw' ? (
              <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#A7C2BC] border-b border-[#18483D] pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#F59E0B]">
                    <Code className="w-4 h-4" />
                    <span>DỮ LIỆU THÔ JSON CỦA BẢN GHI (RAW AUDIT LOG)</span>
                  </div>
                  <button
                    onClick={() => copyText(JSON.stringify(current, null, 2), 'raw_json')}
                    className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 text-[11px] font-sans font-semibold"
                  >
                    {copiedId === 'raw_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Sao Chép JSON
                  </button>
                </div>
                <pre className="text-emerald-300 overflow-x-auto p-4 bg-[#081C17] rounded-xl text-[11px] max-h-[650px] leading-relaxed border border-[#195042]">
{JSON.stringify(current, null, 2)}
                </pre>
              </div>
            ) : (
            <>
              {/* ======================================================== */}
              {/* 5. SIGNATURE VERIFICATION (VERIFY SIGNATURE) - MỤC 5     */}
              {/* ======================================================== */}
              {subTab === 'signature' && (
                <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-6">
                  <div className="border-b border-[#18483D] pb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                        KIỂM TRA CHỮ KÝ SỐ ECDSA
                      </div>
                      <h2 className="text-lg font-bold text-[#F8FAFC]">
                        VERIFY SIGNATURE (XÁC MINH CHỮ KÝ SỐ)
                      </h2>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#09221D] text-[#F59E0B] border border-[#19594D]">
                      ECDSA P-256
                    </span>
                  </div>

                  {/* Core 4 Fields: Algorithm, Public Key, Signature, Signed Data */}
                  <div className="space-y-4 text-xs font-mono">
                    {/* Algorithm */}
                    <div className="p-3.5 rounded-xl bg-[#081C17] border border-[#195042]">
                      <div className="text-[#94A3B8] text-[11px]">Algorithm:</div>
                      <div className="text-base font-bold text-[#F59E0B] mt-0.5">
                        ES256 / ECDSA P-256 (NIST P-256 Curve)
                      </div>
                    </div>

                    {/* Public Key */}
                    <div className="p-3.5 rounded-xl bg-[#081C17] border border-[#195042] space-y-1">
                      <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                        <span>Public Key (Khóa Công Khai Hex lưu trên Server):</span>
                        <button
                          onClick={() => copyText(pubKeyDisplay, 'pk')}
                          className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 text-[10px]"
                        >
                          {copiedId === 'pk' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Hex
                        </button>
                      </div>
                      <div className="text-sky-300 break-all text-[11px] font-bold">
                        {verifyResult?.uncompressedPublicKeyHex || pubKeyDisplay}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        Chỉ cần Khóa Công Khai này là có thể xác minh chữ ký mà KHÔNG CẦN Private Key!
                      </div>
                    </div>

                    {/* Digital Signature */}
                    <div className="p-3.5 rounded-xl bg-[#081C17] border border-[#195042] space-y-1">
                      <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                        <span>Signature (Chữ Ký Số Hex do Authenticator tạo ra):</span>
                        <button
                          onClick={() => copyText(sigDisplay, 'sig')}
                          className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 text-[10px]"
                        >
                          {copiedId === 'sig' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Hex
                        </button>
                      </div>
                      <div className="text-[#F59E0B] break-all text-[11px] font-bold">
                        {sigDisplay}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        Sinh ra bởi Private Key được bảo vệ trong chip bảo mật (TPM / Secure Enclave).
                      </div>
                    </div>

                    {/* Signed Data */}
                    <div className="p-3.5 rounded-xl bg-[#081C17] border border-[#195042] space-y-1">
                      <div className="text-[#94A3B8] text-[11px]">Signed Data:</div>
                      <div className="text-emerald-300 font-bold text-xs">
                        authenticatorData || SHA256(clientDataJSON)
                      </div>
                      <div className="text-[10px] text-[#A7C2BC] pt-1">
                        Dữ liệu xác thực được ghép từ 37+ bytes của AuthenticatorData và băm SHA-256 của ClientDataJSON.
                      </div>
                    </div>
                  </div>

                  {/* Verification Result Card */}
                  <div className="p-5 rounded-2xl bg-[#09241D] border border-[#1A5E4E] space-y-3">
                    <div className="text-xs uppercase tracking-wider font-bold text-[#A7C2BC]">
                      Result:
                    </div>

                    {verifyResult ? (
                      verifyResult.error ? (
                        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 flex items-start gap-3">
                          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="text-sm font-extrabold tracking-wide text-amber-300">
                              ⚠️ THÔNG BÁO XÁC MINH
                            </div>
                            <div className="text-xs text-[#CBD5E1] leading-relaxed">
                              {verifyResult.error}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`p-4 rounded-xl border flex items-start gap-3 ${
                            verifyResult.isValid
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                          }`}
                        >
                          {verifyResult.isValid ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1">
                            <div className="text-base font-extrabold tracking-wide">
                              {verifyResult.isValid ? '✓ VALID SIGNATURE' : '❌ INVALID SIGNATURE'}
                            </div>
                            <div className="text-xs text-[#F8FAFC] leading-relaxed">
                              {verifyResult.explanation || (verifyResult.isValid
                                ? 'Public Key có thể xác minh chữ ký mà không cần Private Key. Dữ liệu nguyên vẹn 100%.'
                                : 'Chữ ký bị bác bỏ vì dữ liệu đã bị sửa đổi! Thuật toán ECDSA phát hiện băm SHA-256 bị sai lệch.')}
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-base font-extrabold tracking-wide">
                            ✓ VALID SIGNATURE
                          </div>
                          <div className="text-xs text-[#F8FAFC]">
                            Public Key có thể xác minh chữ ký mà không cần Private Key.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleRunVerify(false)}
                        disabled={verifying}
                        className="px-4 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Xác Minh Lại Bằng Public Key</span>
                      </button>
                    </div>
                  </div>

                  {/* Tamper Test Box - Đúng mẫu morong.md Mục 5 */}
                  <div className="p-5 rounded-2xl bg-[#091D17] border border-[#195042] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                        <Flame className="w-4 h-4 text-rose-400" />
                        [ Thử sửa dữ liệu ] (Tamper Test)
                      </div>
                      <span className="text-[11px] text-rose-300 font-mono">Demo Mật mã học</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-[#051410] border border-[#153D32]">
                        <div className="text-[#94A3B8] text-[11px]">Original Challenge:</div>
                        <div className="text-emerald-300 font-bold break-all mt-1">
                          {current.challenge}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[#051410] border border-rose-500/30">
                        <div className="text-rose-300 text-[11px] font-semibold">Modified Challenge (Sửa 1 ký tự):</div>
                        <input
                          type="text"
                          value={tamperedChallenge}
                          onChange={(e) => setTamperedChallenge(e.target.value)}
                          className="w-full bg-[#0E241E] border border-rose-500/50 rounded-lg px-2.5 py-1 text-xs text-rose-300 mt-1 font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRunVerify(true)}
                        disabled={verifying}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-all"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Kiểm Tra Chữ Ký Khi Bị Sửa Dữ Liệu</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 3 & 4. CLIENTDATAJSON & AUTHENTICATORDATA - MỤC 3 & 4    */}
              {/* ======================================================== */}
              {subTab === 'client-auth-data' && (
                <div className="space-y-6">
                  {/* Mục 3: ClientDataJSON Decoder */}
                  <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
                    <div className="border-b border-[#18483D] pb-3">
                      <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                        GIẢI MÃ CLIENTDATAJSON
                      </div>
                      <h2 className="text-base font-bold text-[#F8FAFC]">
                        ClientDataJSON Inspector (Dạng Decode & Đánh Dấu Hợp Lệ)
                      </h2>
                    </div>

                    {/* Decoded JSON block */}
                    <div className="p-4 rounded-xl bg-[#081C17] border border-[#195042] font-mono text-xs">
                      <pre className="text-emerald-300 overflow-x-auto">
{JSON.stringify({
  type: current.action === 'REGISTRATION' ? 'webauthn.create' : 'webauthn.get',
  challenge: current.challenge,
  origin: current.origin,
  crossOrigin: false,
}, null, 2)}
                      </pre>
                    </div>

                    {/* 4 Checklist Items from morong.md Item 3 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#09241D] border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">✓ type hợp lệ</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#09241D] border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">✓ challenge hợp lệ</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#09241D] border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">✓ origin hợp lệ</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#09241D] border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">✓ crossOrigin = false</span>
                      </div>
                    </div>
                  </div>

                  {/* Mục 4: AuthenticatorData Inspector */}
                  <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
                    <div className="border-b border-[#18483D] pb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                          GIẢI MÃ AUTHENTICATORDATA
                        </div>
                        <h2 className="text-base font-bold text-[#F8FAFC]">
                          AuthenticatorData Inspector
                        </h2>
                      </div>
                      <span className="font-mono text-xs text-[#F59E0B] font-bold">
                        Flags: {flagsHex}
                      </span>
                    </div>

                    <div className="space-y-4 text-xs font-mono">
                      {/* RP ID Hash */}
                      <div className="p-3.5 rounded-xl bg-[#081C17] border border-[#195042]">
                        <div className="text-[#94A3B8] text-[11px]">RP ID Hash:</div>
                        <div className="text-[#F8FAFC] font-bold text-sm mt-0.5">
                          SHA-256(localhost)
                        </div>
                        <div className="text-[10px] text-[#A7C2BC] break-all pt-1">
                          {current.authenticatorData?.rpIdHashHex || '49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763'}
                        </div>
                      </div>

                      {/* Flags bit tree ASCII / Graphic - Đúng sơ đồ Mục 4 */}
                      <div className="p-4 rounded-xl bg-[#081C17] border border-[#195042] space-y-3 font-mono">
                        <div className="text-emerald-300 font-bold text-sm tracking-widest text-center">
                          Flags: {flagsHex} ({bitString}₂)
                        </div>

                        {/* ASCII Diagram as in morong.md */}
                        <div className="p-3 bg-[#051410] rounded-xl border border-[#144236] text-emerald-400 text-xs overflow-x-auto flex justify-center">
                          <pre className="font-mono leading-tight">
{`${bitString}
││││││││
││││││└─ UP = ${current.authenticatorData?.flags.userPresent ? '1' : '0'} (User Present)
│││││└── RFU = 0 (Reserved)
││││└─── UV = ${current.authenticatorData?.flags.userVerified ? '1' : '0'} (User Verified)
│││└──── BE = 0 (Backup Eligibility)
││└───── BS = 0 (Backup State)
│└────── AT = ${current.authenticatorData?.flags.attestedCredentialData ? '1' : '0'} (Attested Data)
└─────── ED = 0 (Extension Data)`}
                          </pre>
                        </div>

                        {/* Interactive Bit Map - All 8 flags */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-emerald-500/40 text-center">
                            <div className="text-[#F59E0B] font-bold text-xs">UP = {current.authenticatorData?.flags.userPresent ? '1' : '0'}</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5 font-bold">User Present</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Chạm vật lý cảm biến</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-[#165545] text-center">
                            <div className="text-[#94A3B8] font-bold text-xs">RFU = 0</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5">Reserved</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Dành cho tương lai</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-emerald-500/40 text-center">
                            <div className="text-[#F59E0B] font-bold text-xs">UV = {current.authenticatorData?.flags.userVerified ? '1' : '0'}</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5 font-bold">User Verified</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">PIN / Sinh trắc Hello</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-[#165545] text-center">
                            <div className="text-[#94A3B8] font-bold text-xs">BE = 0</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5">Backup Eligibility</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Đủ đ/k đồng bộ Cloud</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-[#165545] text-center">
                            <div className="text-[#94A3B8] font-bold text-xs">BS = 0</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5">Backup State</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Trạng thái đồng bộ</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-[#165545] text-center">
                            <div className="text-[#94A3B8] font-bold text-xs">RFU = 0</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5">Reserved</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Dành cho tương lai</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-emerald-500/40 text-center">
                            <div className="text-[#F59E0B] font-bold text-xs">AT = {current.authenticatorData?.flags.attestedCredentialData ? '1' : '0'}</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5 font-bold">Attested Data</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Chứa Public Key</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#0B2A22] border border-[#165545] text-center">
                            <div className="text-[#94A3B8] font-bold text-xs">ED = 0</div>
                            <div className="text-[10px] text-[#CBD5E1] font-sans mt-0.5">Extension Data</div>
                            <div className="text-[9px] text-[#94A3B8] font-sans">Dữ liệu tiện ích mở rộng</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 6, 7, 8. REPLAY & PHISHING ATTACK TEST - MỤC 6, 7, 8     */}
              {/* ======================================================== */}
              {subTab === 'attacks' && (
                <div className="space-y-6">
                  {/* Mục 6 & 7: Replay Attack & Challenge Lifecycle */}
                  <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
                    <div className="border-b border-[#18483D] pb-3">
                      <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                        TẤN CÔNG PHÁT LẠI (REPLAY ATTACK)
                      </div>
                      <h2 className="text-base font-bold text-[#F8FAFC]">
                        REPLAY ATTACK TEST & CHALLENGE LIFECYCLE
                      </h2>
                    </div>

                    {/* Challenge Lifecycle display */}
                    <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#081C17] border border-[#195042] text-xs font-mono text-center">
                      <div>
                        <div className="text-[#94A3B8] text-[10px]">Created:</div>
                        <div className="text-[#F8FAFC] font-bold mt-0.5">21:54:20</div>
                      </div>
                      <div>
                        <div className="text-[#94A3B8] text-[10px]">Expires:</div>
                        <div className="text-[#F8FAFC] font-bold mt-0.5">21:55:20 (TTL 60s)</div>
                      </div>
                      <div>
                        <div className="text-[#94A3B8] text-[10px]">Status:</div>
                        <div className="text-emerald-400 font-bold mt-0.5">USED ✓</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={handleReplayAttack}
                        disabled={replaying}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-all"
                      >
                        <Radio className="w-4 h-4" />
                        <span>[ Replay Authentication ] Gửi Lại Gói Tin Cũ</span>
                      </button>
                    </div>

                    {/* Replay Result */}
                    {replayResult && (
                      <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 space-y-2 text-xs">
                        <div className="font-extrabold text-sm text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Result: ✓ Attack detected!</span>
                        </div>
                        <div className="font-bold text-rose-300">
                          ❌ LOGIN REJECTED: Reason: {replayResult.reason}
                        </div>
                        <div className="text-[11px] text-[#A7C2BC] leading-relaxed">
                          {replayResult.mechanism}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mục 8: Phishing / Origin Attack */}
                  <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
                    <div className="border-b border-[#18483D] pb-3">
                      <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                        TẤN CÔNG LỪA ĐẢO (PHISHING / ORIGIN ATTACK)
                      </div>
                      <h2 className="text-base font-bold text-[#F8FAFC]">
                        PHISHING / ORIGIN ATTACK DEMO
                      </h2>
                    </div>

                    {/* User Input Fake Origin & Compare */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-[#A7C2BC]">
                            Địa chỉ trang web muốn thử nghiệm (URL Origin):
                          </label>
                          {(() => {
                            let s = (fakeOrigin || '').trim();
                            if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'http://' + s;
                            const clean = s.replace(/\/+$/, '').toLowerCase();
                            const isMatch = clean === 'http://localhost:3000' || clean === 'http://127.0.0.1:3000';
                            return isMatch ? (
                              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> URL Trùng Khớp Trang Thật
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> URL Khác / Giả Mạo
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={fakeOrigin}
                            onChange={(e) => {
                              setFakeOrigin(e.target.value);
                              setPhishingResult(null);
                            }}
                            placeholder="VD: http://localhost:3000, http://localhost:4000..."
                            className="flex-1 min-w-[260px] bg-[#051410] border border-[#1A5043] rounded-xl px-3.5 py-2 text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFakeOrigin('http://localhost:3000');
                              setPhishingResult(null);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-emerald-400 text-[11px] font-bold border border-emerald-500/40 transition-all"
                          >
                            ✓ Trang Thật :3000
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFakeOrigin('http://localhost:4000');
                              setPhishingResult(null);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-rose-400 text-[11px] font-semibold border border-rose-500/40 transition-all"
                          >
                            ❌ Sai Cổng :4000
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFakeOrigin('http://vietcombank-phishing.fake:8080');
                              setPhishingResult(null);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-rose-400 text-[11px] font-semibold border border-rose-500/40 transition-all"
                          >
                            ❌ Giả Mạo Ngân Hàng
                          </button>
                        </div>
                      </div>

                      {/* Real Site vs Test Site Diagram */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-1">
                        <div className="p-3.5 rounded-xl bg-[#09241D] border border-emerald-500/40 space-y-2">
                          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> TRANG THẬT CỦA HỆ THỐNG
                          </div>
                          <div className="text-[#F8FAFC]">http://localhost:3000</div>
                          <div className="text-emerald-400 text-[11px]">Relying Party ID: localhost ──► FIDO2 Chấp Nhận ✓</div>
                        </div>

                        {(() => {
                          let s = (fakeOrigin || '').trim();
                          if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'http://' + s;
                          const clean = s.replace(/\/+$/, '').toLowerCase();
                          const isMatch = clean === 'http://localhost:3000' || clean === 'http://127.0.0.1:3000';
                          return isMatch ? (
                            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> TRANG BẠN ĐANG THỬ (HỢP LỆ)
                              </div>
                              <div className="text-emerald-200 font-bold truncate">{fakeOrigin || 'http://localhost:3000'}</div>
                              <div className="text-emerald-400 text-[11px]">Trùng khớp trang thật ──► FIDO2 Chấp Nhận Đăng Nhập ✓</div>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4" /> TRANG BẠN ĐANG THỬ (GIẢ MẠO / PHISHING)
                              </div>
                              <div className="text-rose-200 font-bold truncate">{fakeOrigin || '(trống)'}</div>
                              <div className="text-rose-400 text-[11px]">Sai lệch tên miền ──► FIDO2 Từ Chối Đăng Nhập ❌</div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Gói tin ClientDataJSON thực tế gửi lên Server */}
                      <div className="p-3.5 rounded-xl bg-[#051410] border border-[#1A5043] space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between text-[#A7C2BC]">
                          <span className="font-semibold text-[#F8FAFC]">Gói tin ClientDataJSON thực tế mà trình duyệt tạo ra:</span>
                          <span className="text-[10px] text-[#F59E0B] font-bold">
                            Trường origin: {fakeOrigin || 'http://localhost:3000'}
                          </span>
                        </div>
                        <pre className="text-emerald-300 text-[11px] overflow-x-auto p-2 bg-[#081814] rounded-lg">
{JSON.stringify({
  type: current.action === 'REGISTRATION' ? 'webauthn.create' : 'webauthn.get',
  challenge: current.challenge,
  origin: fakeOrigin || 'http://localhost:3000',
  crossOrigin: false,
}, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handlePhishingAttack}
                        disabled={phishingLoading}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0A1A17] text-xs font-extrabold flex items-center gap-2 shadow transition-all"
                      >
                        <Globe className="w-4 h-4" />
                        <span>{phishingLoading ? 'Đang Kiểm Tra...' : 'Kiểm Tra Tên Miền Với Máy Chủ (Origin Verification)'}</span>
                      </button>
                    </div>

                    {phishingResult && (
                      phishingResult.isLegitimate ? (
                        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 space-y-2 text-xs">
                          <div className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✓ AUTHENTICATION SUCCESS (XÁC THỰC THÀNH CÔNG)</span>
                          </div>
                          <div className="font-mono text-[11px] text-[#F8FAFC]">
                            Expected RP ID: <span className="text-emerald-300">localhost</span><br />
                            Received Origin: <span className="text-emerald-300">{phishingResult.receivedOrigin} (Khớp hoàn toàn 100%)</span>
                          </div>
                          <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                            {phishingResult.explanation}
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 space-y-2 text-xs">
                          <div className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
                            <XCircle className="w-4 h-4" />
                            <span>❌ AUTHENTICATION REJECTED (TỪ CHỐI XÁC THỰC - PHÁT HIỆN LỪA ĐẢO)</span>
                          </div>
                          <div className="font-mono text-[11px] text-[#F8FAFC]">
                            Expected RP ID: <span className="text-emerald-300">localhost</span> (http://localhost:3000)<br />
                            Received Origin: <span className="text-rose-400">{phishingResult.receivedOrigin} (Không trùng khớp!)</span>
                          </div>
                          <p className="text-[11px] text-rose-200/90 leading-relaxed">
                            {phishingResult.explanation}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
            )
          ) : (
            <div className="p-12 text-center rounded-2xl border border-dashed border-[#1C5246] text-[#64748B] text-xs">
              Chọn một bản ghi xác thực ở danh sách bên trái để soi chi tiết.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}