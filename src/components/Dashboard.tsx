'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Laptop,
  Smartphone,
  Trash2,
  PlusCircle,
  Clock,
  Hash,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  User as UserIcon,
  Edit2,
  X,
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

interface DashboardProps {
  user: any;
  onRefreshUser: () => void;
  onLogout: () => void;
  onNavigateToInspector: () => void;
  onNavigateToLab?: () => void;
}

export default function Dashboard({
  user,
  onRefreshUser,
  onLogout,
  onNavigateToInspector,
  onNavigateToLab,
}: DashboardProps) {
  const [addingDevice, setAddingDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [deviceAttachment, setDeviceAttachment] = useState<'platform' | 'cross-platform'>('platform');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit Display Name state
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user.displayName || user.username);

  // Delete Account Confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newDisplayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật tên');
      setMsg({ type: 'success', text: 'Đã cập nhật tên hiển thị thành công!' });
      setEditingName(false);
      onRefreshUser();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi cập nhật tên' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa tài khoản');
      alert(data.message || 'Tài khoản đã được xóa hoàn toàn và toàn bộ Passkey đã bị thu hồi.');
      onLogout();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi khi xóa tài khoản' });
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRegisterAdditionalKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMsg(null);

    try {
      const optRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          displayName: user.displayName,
          authenticatorAttachment: deviceAttachment === 'platform' ? 'platform' : undefined,
        }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData.error || 'Lỗi tạo tùy chọn đăng ký');

      const attResp = await startRegistration({ optionsJSON: optData.options });

      const verifRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          response: attResp,
          deviceName: newDeviceName.trim() || (deviceAttachment === 'platform' ? 'Windows Hello bổ sung' : 'Điện thoại Passkey'),
        }),
      });

      const verifData = await verifRes.json();
      if (!verifRes.ok) throw new Error(verifData.error || 'Xác minh khóa thất bại');

      setMsg({ type: 'success', text: 'Đã thêm khóa bảo mật mới thành công!' });
      setAddingDevice(false);
      setNewDeviceName('');
      onRefreshUser();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi thêm thiết bị' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteKey = async (credentialId: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi (xóa) khóa FIDO2 này không? Bạn sẽ không thể dùng thiết bị này để đăng nhập nữa.')) return;
    setActionLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa khóa');

      setMsg({ type: 'success', text: 'Đã thu hồi khóa bảo mật thành công' });
      onRefreshUser();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi khi xóa khóa' });
    } finally {
      setActionLoading(false);
    }
  };

  const credentials = user.credentials || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account Info & User Profile Card */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl shadow-black/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B] text-[#0A1A17] flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {editingName ? (
                  <form onSubmit={handleUpdateDisplayName} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="bg-[#091D18] text-[#F8FAFC] border border-[#F59E0B] rounded-lg px-2 py-0.5 text-sm font-bold focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-2 py-0.5 rounded bg-[#F59E0B] text-[#0A1A17] text-xs font-bold"
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="text-xs text-[#94A3B8]"
                    >
                      Hủy
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-[#F8FAFC]">
                      {user.displayName || user.username}
                    </h2>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded text-[#94A3B8] hover:text-[#F59E0B]"
                      title="Sửa tên hiển thị"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0A2621] text-[#F59E0B] border border-[#19594D]">
                  @{user.username}
                </span>
              </div>
              <p className="text-xs text-[#A7C2BC] mt-0.5">
                Tài khoản xác thực không mật khẩu (FIDO2 Passwordless Authenticated)
              </p>
            </div>
          </div>

          {/* Quick Account Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onNavigateToInspector}
              className="px-3.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#F8FAFC] text-xs font-bold flex items-center gap-1.5 transition-all border border-[#1A574A]"
            >
              <Key className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>FIDO2 Inspector</span>
            </button>

            {onNavigateToLab && (
              <button
                onClick={onNavigateToLab}
                className="px-3.5 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#F8FAFC] text-xs font-bold flex items-center gap-1.5 transition-all border border-[#1A574A]"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Phòng Lab Tấn Công</span>
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all border border-rose-500/40"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Xóa Tài Khoản</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#18483D]">
          <div className="p-3 rounded-xl bg-[#0A2620] border border-[#17483D]">
            <div className="text-[11px] text-[#94A3B8]">Số lượng Passkeys:</div>
            <div className="text-base font-extrabold text-[#F59E0B] font-mono mt-0.5">
              {credentials.length} Khóa
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0A2620] border border-[#17483D]">
            <div className="text-[11px] text-[#94A3B8]">Trạng thái bảo mật:</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Hoạt động
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0A2620] border border-[#17483D]">
            <div className="text-[11px] text-[#94A3B8]">Ngày khởi tạo:</div>
            <div className="text-xs font-semibold text-[#F8FAFC] font-mono mt-1">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0A2620] border border-[#17483D]">
            <div className="text-[11px] text-[#94A3B8]">Phương thức xác thực:</div>
            <div className="text-xs font-semibold text-[#CBD5E1] mt-1">
              Sinh trắc / Mã PIN
            </div>
          </div>
        </div>
      </div>

      {/* Passkey & Device Management Section */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl shadow-black/40 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#F59E0B]" />
              Danh Sách Thiết Bị & Passkeys Đã Đăng Ký
            </h3>
            <p className="text-xs text-[#A7C2BC] mt-0.5">
              Quản lý các khóa FIDO2 được ủy quyền cho tài khoản này. Khóa riêng (Private Key) được lưu an toàn trong phần cứng thiết bị.
            </p>
          </div>

          <button
            onClick={() => setAddingDevice(!addingDevice)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/25 shrink-0 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Passkey Mới</span>
          </button>
        </div>

        {/* Add Device Form Drawer */}
        {addingDevice && (
          <form
            onSubmit={handleRegisterAdditionalKey}
            className="p-5 rounded-2xl bg-[#09221D] border border-[#1D6052] space-y-4"
          >
            <div className="text-sm font-bold text-[#F8FAFC]">
              Đăng Ký Thêm Khóa FIDO2 Mới Cho Tài Khoản
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#A7C2BC] font-semibold mb-1">
                  Tên thiết bị nhận diện:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Windows Hello Laptop cá nhân, iPhone 15 Pro..."
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-[#081814] border border-[#1C5447] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div>
                <label className="block text-[#A7C2BC] font-semibold mb-1">
                  Phương thức đăng ký:
                </label>
                <select
                  value={deviceAttachment}
                  onChange={(e: any) => setDeviceAttachment(e.target.value)}
                  className="w-full bg-[#081814] border border-[#1C5447] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B]"
                >
                  <option value="platform">Windows Hello (Platform - PIN / Vân tay máy tính)</option>
                  <option value="cross-platform">Điện thoại di động (Cross-Device Passkey qua QR Code)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                <span>Xác Thực & Thêm Khóa</span>
              </button>

              <button
                type="button"
                onClick={() => setAddingDevice(false)}
                className="px-3.5 py-2 rounded-xl bg-transparent hover:bg-white/5 text-[#94A3B8] text-xs font-semibold"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentials.length === 0 ? (
            <div className="col-span-2 p-8 text-center rounded-2xl border border-dashed border-[#1C5246] text-[#64748B] text-xs">
              Chưa có khóa bảo mật nào được lưu cho tài khoản này.
            </div>
          ) : (
            credentials.map((cred: any, index: number) => {
              const isPhone = cred.deviceName?.toLowerCase().includes('thoai') || cred.deviceName?.toLowerCase().includes('phone');

              return (
                <div
                  key={cred.id || index}
                  className="p-4 rounded-xl border border-[#1A4C40] bg-[#0A2620] space-y-3 relative group hover:border-[#24705F] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#09221D] border border-[#19594D] text-[#F59E0B] flex items-center justify-center font-bold">
                        {isPhone ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F8FAFC]">
                          {cred.deviceName || (isPhone ? 'Điện thoại Passkey' : 'Windows Hello Platform')}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Platform Authenticator • Active
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteKey(cred.id)}
                      disabled={actionLoading}
                      title="Thu hồi / Xóa Passkey này"
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata info */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-[#144237]">
                    <div>
                      <span className="text-[#94A3B8]">Sign Counter: </span>
                      <span className="text-[#F59E0B] font-bold">{cred.counter ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8]">Ngày tạo: </span>
                      <span className="text-[#CBD5E1]">
                        {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString('vi-VN') : '07/10/2026'}
                      </span>
                    </div>
                  </div>

                  {/* Credential ID truncated */}
                  <div className="p-2 rounded bg-[#081814] border border-white/5 flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
                    <span className="truncate max-w-[200px]">ID: {cred.id}</span>
                    <button
                      onClick={() => copyToClipboard(cred.id, cred.id)}
                      className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1 ml-2 shrink-0"
                    >
                      {copiedKey === cred.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0E241E] border border-rose-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Xác Nhận Xóa Tài Khoản?</h3>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <strong className="text-white">@{user.username}</strong>?
              Hành động này sẽ <strong>thu hồi và vô hiệu hóa vĩnh viễn toàn bộ {credentials.length} Passkeys</strong> đã gắn với tài khoản.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#94A3B8] text-xs font-semibold border border-[#1A574A]"
              >
                Hủy bỏ (Cancel)
              </button>

              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30"
              >
                {deletingAccount ? 'Đang Xóa...' : 'Xác Nhận Xóa (Delete)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}