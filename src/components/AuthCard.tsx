'use client';

import React, { useState } from 'react';
import {
  Fingerprint,
  Key,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface AuthCardProps {
  onAuthSuccess: (user: any, auditLog: any) => void;
  onInspectRequested: () => void;
}

export default function AuthCard({ onAuthSuccess, onInspectRequested }: AuthCardProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authenticatorAttachment, setAuthenticatorAttachment] = useState<'platform' | 'all'>('platform');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Vui lòng nhập tên tài khoản (Username)');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setStatusMessage('Đang yêu cầu Server phát sinh Challenge ngẫu nhiên...');

    try {
      const optRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          authenticatorAttachment,
        }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optData.error || 'Không thể tạo tùy chọn đăng ký FIDO2');
      }

      setStatusMessage(
        authenticatorAttachment === 'platform'
          ? 'Vui lòng xác thực Windows Hello (Nhập mã PIN hoặc chạm vân tay trên máy)...'
          : 'Cửa sổ mở ra: Hãy quét mã QR bằng camera điện thoại để xác thực...'
      );

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optData.options });
      } catch (clientErr: any) {
        if (clientErr.name === 'NotAllowedError') {
          throw new Error(
            'Thao tác bị hủy hoặc thiết bị chưa được kích hoạt. Hãy đảm bảo đã cài Windows Hello PIN trong Settings (hoặc chọn "Điện Thoại" để quét QR).'
          );
        }
        throw new Error(clientErr.message || 'Lỗi khi giao tiếp với thiết bị bảo mật.');
      }

      setStatusMessage('Đang gửi Khóa công khai về máy chủ để lưu trữ và xác minh...');

      const verifRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          response: attResp,
          deviceName:
            authenticatorAttachment === 'platform'
              ? 'Windows Hello (Sinh trắc / TPM)'
              : 'Điện thoại thông minh (Passkey)',
        }),
      });

      const verifData = await verifRes.json();
      if (!verifRes.ok) {
        throw new Error(verifData.error || 'Xác minh khóa công khai thất bại');
      }

      setStatusMessage(null);
      setSuccessInfo({
        type: 'Đăng ký thành công!',
        message: `Đã khởi tạo cặp khóa mật mã bất đối xứng (ES256). Khóa bí mật được bảo vệ an toàn trên thiết bị của bạn.`,
        log: verifData.auditLog,
      });

      onAuthSuccess(verifData.user, verifData.auditLog);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(null);
      setErrorMessage(err.message || 'Quá trình đăng ký gặp sự cố');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setStatusMessage('Đang gửi yêu cầu đăng nhập đến Server...');

    try {
      const optRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || undefined,
        }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optData.error || 'Không thể tạo phiên đăng nhập');
      }

      setStatusMessage('Chờ xác thực mã PIN / vân tay hoặc quét mã QR...');

      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: optData.options });
      } catch (clientErr: any) {
        if (clientErr.name === 'NotAllowedError') {
          throw new Error('Thao tác bị hủy bởi người dùng hoặc xác thực không khớp.');
        }
        throw new Error(clientErr.message || 'Lỗi khi giao tiếp với thiết bị.');
      }

      setStatusMessage('Server đang kiểm tra Chữ ký số bằng Khóa công khai...');

      const verifRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || undefined,
          response: asseResp,
        }),
      });

      const verifData = await verifRes.json();
      if (!verifRes.ok) {
        throw new Error(verifData.error || 'Chữ ký mật mã không hợp lệ');
      }

      setStatusMessage(null);
      setSuccessInfo({
        type: 'Đăng nhập thành công!',
        message: `Xác thực thành công không cần mật khẩu! Chữ ký số đã được máy chủ xác minh.`,
        log: verifData.auditLog,
      });

      onAuthSuccess(verifData.user, verifData.auditLog);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(null);
      setErrorMessage(err.message || 'Quá trình đăng nhập gặp lỗi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Container in Forest Pine / Deep Emerald with Navy border */}
      <div className="rounded-2xl border border-[#1C5246] bg-[#0E352D] p-6 sm:p-8 shadow-2xl shadow-black/50">
        {/* Header Tabs Switcher */}
        <div className="flex items-center justify-between border-b border-[#18483D] pb-5 mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#F8FAFC]">
              {mode === 'login' ? 'Đăng Nhập Passkey' : 'Đăng Ký Khóa FIDO2'}
            </h2>
            <p className="text-xs text-[#A7C2BC] mt-0.5">
              Xác thực không mật khẩu an toàn qua Mật mã bất đối xứng
            </p>
          </div>

          <div className="flex bg-[#0A2621] p-1 rounded-xl border border-[#16443A]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-[#F59E0B] text-[#0A1A17] font-extrabold shadow-sm'
                  : 'text-[#A7C2BC] hover:text-[#F8FAFC]'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-[#F59E0B] text-[#0A1A17] font-extrabold shadow-sm'
                  : 'text-[#A7C2BC] hover:text-[#F8FAFC]'
              }`}
            >
              Đăng ký
            </button>
          </div>
        </div>

        {/* Main Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
              Tên tài khoản (Username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập username của bạn"
              className="w-full px-4 py-3 rounded-xl bg-[#121C24] border border-[#1E4E42] text-[#F8FAFC] text-sm placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-[#F59E0B] transition-all"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
                Họ tên hiển thị
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập họ và tên hiển thị"
                className="w-full px-4 py-3 rounded-xl bg-[#121C24] border border-[#1E4E42] text-[#F8FAFC] text-sm placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-[#F59E0B] transition-all"
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
                Chọn phương thức xác thực:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAuthenticatorAttachment('platform')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                    authenticatorAttachment === 'platform'
                      ? 'border-[#F59E0B] bg-[#114237] text-[#F8FAFC] ring-1 ring-[#F59E0B]/50'
                      : 'border-[#18483D] bg-[#0A2621] text-[#94A3B8] hover:border-[#225C50]'
                  }`}
                >
                  <Laptop className={`w-5 h-5 ${authenticatorAttachment === 'platform' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`} />
                  <span className="text-xs font-bold text-center">Windows Hello</span>
                  <span className="text-[10px] text-[#A7C2BC] text-center">Mã PIN / Vân tay máy tính</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthenticatorAttachment('all')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                    authenticatorAttachment === 'all'
                      ? 'border-[#F59E0B] bg-[#114237] text-[#F8FAFC] ring-1 ring-[#F59E0B]/50'
                      : 'border-[#18483D] bg-[#0A2621] text-[#94A3B8] hover:border-[#225C50]'
                  }`}
                >
                  <Smartphone className={`w-5 h-5 ${authenticatorAttachment === 'all' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`} />
                  <span className="text-xs font-bold text-center">Điện Thoại</span>
                  <span className="text-[10px] text-[#A7C2BC] text-center">Quét QR (FaceID / Vân tay)</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick helpful tips */}
          {authenticatorAttachment === 'platform' && mode === 'register' && (
            <div className="p-3.5 rounded-xl bg-[#09221D] border border-[#164D40] text-xs text-[#CBD5E1] space-y-1">
              <div className="font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-[#F59E0B]" />
                Xác thực bằng Windows Hello:
              </div>
              <div className="text-[11px] text-[#94A3B8] leading-relaxed pl-5 list-disc space-y-0.5">
                <div>Windows sẽ mở cửa sổ yêu cầu nhập <strong>Mã PIN máy tính</strong> (hoặc vân tay).</div>
                <div>Sau khi xác nhận, chip TPM sẽ tạo cặp khóa bảo mật FIDO2 an toàn.</div>
              </div>
            </div>
          )}

          {authenticatorAttachment === 'all' && mode === 'register' && (
            <div className="p-3.5 rounded-xl bg-[#09221D] border border-[#164D40] text-xs text-[#CBD5E1] space-y-1">
              <div className="font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#F59E0B]" />
                Xác thực qua điện thoại:
              </div>
              <div className="text-[11px] text-[#94A3B8] leading-relaxed pl-5 list-disc space-y-0.5">
                <div>1. Nhấn nút bên dưới → Chọn <strong>"Use a phone or tablet"</strong>.</div>
                <div>2. Mở Camera điện thoại quét mã QR và chạm <strong>FaceID / Vân tay</strong>.</div>
              </div>
            </div>
          )}

          {/* Status Feedback */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-[#09221D] border border-[#1A574A] text-xs text-[#E2E8F0] flex items-start gap-2.5">
              <Fingerprint className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5 animate-pulse" />
              <div className="leading-relaxed">{statusMessage}</div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-[#2D1619] border border-[#5C2329] text-xs text-[#FCA5A5] space-y-1.5">
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Success Message Banner */}
          {successInfo && (
            <div className="p-4 rounded-xl bg-[#0B2A22] border border-[#165545] text-xs text-[#A7F3D0] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#D1FAE5]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {successInfo.type}
              </div>
              <div className="leading-relaxed text-[#6EE7B7]">{successInfo.message}</div>
              <button
                type="button"
                onClick={onInspectRequested}
                className="mt-2 w-full py-2 px-3 rounded-lg bg-[#114237] hover:bg-[#165545] border border-[#1E6956] text-[#F8FAFC] text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Key className="w-3.5 h-3.5 text-[#F59E0B]" /> Xem chi tiết Khóa & Chữ Ký trong FIDO2 Inspector
              </button>
            </div>
          )}

          {/* High-contrast Golden Yellow Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
              loading
                ? 'bg-[#18483D] text-[#64748B] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#D97706] text-[#091815] shadow-amber-500/25 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#091815]/30 border-t-[#091815] rounded-full animate-spin" />
                <span>Đang xử lý xác thực...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <Fingerprint className="w-5 h-5 text-[#091815]" />
                <span>Xác Thực Đăng Nhập Passkey</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-[#091815]" />
                <span>Tạo Khóa & Đăng Ký FIDO2</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-5 pt-4 border-t border-[#18483D] text-[11px] text-[#A7C2BC] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#F59E0B]" /> Bảo vệ bởi TPM / Secure Enclave
          </span>
          <span>Chống Phishing 100%</span>
        </div>
      </div>
    </div>
  );
}