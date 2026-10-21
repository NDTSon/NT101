'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AuthCard from '@/components/AuthCard';
import DeviceManager from '@/components/DeviceManager';
import Fido2Inspector from '@/components/Fido2Inspector';
import { Shield, Key, Laptop, ArrowRight } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('auth');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Session fetch error:', err);
      setUser(null);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleAuthSuccess = (authUser: any, auditLog: any) => {
    setUser(authUser);
    if (auditLog && auditLog.id) {
      setSelectedLogId(auditLog.id);
    }
    fetchSession();
    // Move to device manager after successful login
    setActiveTab('devices');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setActiveTab('auth');
  };

  const handleSelectLogForInspector = (logId: string) => {
    setSelectedLogId(logId);
    setActiveTab('inspector');
  };

  return (
    <div className="min-h-screen bg-[#131C24] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#F59E0B] selection:text-[#0A1A17]">
      {/* Top Navbar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div className="w-8 h-8 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />
            <p className="text-xs text-[#94A3B8]">Đang khởi tạo phiên làm việc...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: AUTHENTICATION (XÁC THỰC FIDO2) */}
            {activeTab === 'auth' && (
              <div className="space-y-10">
                {!user ? (
                  <div className="space-y-8">
                    {/* Hero Header */}
                    <div className="text-center max-w-2xl mx-auto space-y-3">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0E352D] border border-[#19594D] text-[#F59E0B] text-xs font-bold">
                        Đề tài nghiên cứu NT101 • Chuẩn FIDO2 & WebAuthn
                      </div>
                      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F8FAFC]">
                        Bảo Mật Không Mật Khẩu{' '}
                        <span className="text-[#F59E0B] block sm:inline">
                          FIDO2 & Passkey
                        </span>
                      </h1>
                      <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl mx-auto">
                        Ứng dụng cho phép người dùng đăng ký và đăng nhập bảo mật bằng khóa sinh trắc học hoặc mã PIN qua cơ chế mật mã bất đối xứng (Public-key Cryptography).
                      </p>
                    </div>

                    {/* Auth Card (Register / Login) */}
                    <AuthCard
                      onAuthSuccess={handleAuthSuccess}
                      onInspectRequested={() => setActiveTab('inspector')}
                    />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-[#0E352D] border border-[#1C5246] text-center space-y-5 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-[#F59E0B] text-[#0A1A17] flex items-center justify-center font-bold text-2xl mx-auto shadow-lg shadow-amber-500/20">
                      ✓
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-white">
                        Bạn Đang Đăng Nhập Với Tài Khoản @{user.username}
                      </h2>
                      <p className="text-xs text-[#A7C2BC]">
                        Phiên xác thực FIDO2 đang hoạt động an toàn.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => setActiveTab('devices')}
                        className="px-5 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-[#0A1A17] text-xs font-extrabold flex items-center gap-2 shadow"
                      >
                        <Laptop className="w-4 h-4" />
                        <span>Xem Quản Lý Thiết Bị & Passkeys</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setActiveTab('inspector')}
                        className="px-5 py-2.5 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-white text-xs font-bold border border-[#1A574A] flex items-center gap-2"
                      >
                        <Key className="w-4 h-4 text-[#F59E0B]" />
                        <span>Xem FIDO2 Inspector & Chữ Ký Số</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DEVICE & PASSKEY MANAGEMENT () */}
            {activeTab === 'devices' && (
              <DeviceManager
                user={user}
                onRefreshUser={fetchSession}
                onLogout={handleLogout}
                onSelectLogForInspector={handleSelectLogForInspector}
              />
            )}

            {/* TAB 3: FIDO2 INSPECTOR & SIGNATURE VERIFICATION () */}
            {activeTab === 'inspector' && (
              <Fido2Inspector initialLogId={selectedLogId} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E3341] bg-[#0E161C] py-6 text-center text-xs text-[#64748B]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#F59E0B]" />
            <span className="font-semibold text-[#94A3B8]">NT101 - An Toàn Thông Tin Mạng</span>
          </div>
          <div className="text-[#64748B] text-[11px]">
            W3C WebAuthn • Public-Key Cryptography (ECDSA NIST P-256) • Anti-Phishing & Anti-Replay
          </div>
        </div>
      </footer>
    </div>
  );
}