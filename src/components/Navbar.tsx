'use client';

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Key,
  Fingerprint,
  CheckCircle2,
  LogOut,
  User as UserIcon,
  Laptop,
  BookOpen,
} from 'lucide-react';
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';

interface NavbarProps {
  user: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Navbar({ user, activeTab, setActiveTab, onLogout }: NavbarProps) {
  const [platformSupported, setPlatformSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = browserSupportsWebAuthn();
      if (supported) {
        try {
          const platform = await platformAuthenticatorIsAvailable();
          setPlatformSupported(platform);
        } catch {
          setPlatformSupported(false);
        }
      } else {
        setPlatformSupported(false);
      }
    };
    checkSupport();
  }, []);

  const navItems = [
    { id: 'auth', label: 'Xác Thực FIDO2', icon: Fingerprint },
    { id: 'devices', label: 'Quản Lý Thiết Bị', icon: Laptop },
    { id: 'inspector', label: 'FIDO2 Inspector', icon: Key },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#1E3341] bg-[#131C24]/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F59E0B] text-[#0A1A17] shadow-lg shadow-amber-500/20 font-bold">
              <Shield className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-[#F8FAFC]">
                  NT101 • FIDO2
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-[#0E3830] text-[#F59E0B] border border-[#19594D]">
                  Passwordless
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-medium hidden sm:block">
                Hệ thống xác thực sinh trắc học & khóa phần cứng qua Mật mã bất đối xứng
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 bg-[#0D242C] p-1 rounded-xl border border-[#1A3A45]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[#F59E0B] text-[#091815] shadow-md font-extrabold'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#14313B]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status & User */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E342D] border border-[#1B5246] text-[11px]">
              <span className="text-[#94A3B8]">Windows Hello:</span>
              {platformSupported === null ? (
                <span className="text-[#94A3B8]">Đang kiểm tra...</span>
              ) : platformSupported ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#F59E0B] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng qua PIN / QR
                </span>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#1E3341]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E342D] border border-[#1B5246]">
                  <UserIcon className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-xs font-semibold text-[#F8FAFC]">@{user.username}</span>
                </div>
                <button
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}