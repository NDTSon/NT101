'use client';

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Trash2,
  PlusCircle,
  Clock,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User as UserIcon,
  RefreshCw,
  Copy,
  Check,
  X,
  History,
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { CryptoAuditLog } from '@/lib/types';

interface DeviceManagerProps {
  user: any;
  onRefreshUser: () => void;
  onLogout: () => void;
  onSelectLogForInspector: (logId: string) => void;
}

export default function DeviceManager({
  user,
  onRefreshUser,
  onLogout,
  onSelectLogForInspector,
}: DeviceManagerProps) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>(user?.username || '');
  const [currentUserData, setCurrentUserData] = useState<any>(user);
  const [addingDevice, setAddingDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'platform' | 'cross-platform'>('platform');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Authentication history for this user
  const [userLogs, setUserLogs] = useState<CryptoAuditLog[]>([]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUserData(data.user);
        setSelectedUsername(data.user.username);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async (uname: string) => {
    try {
      const res = await fetch('/api/auth/inspector-logs?limit=50');
      const data = await res.json();
      if (data.logs) {
        const filtered = uname
          ? data.logs.filter((l: CryptoAuditLog) => l.username.toLowerCase() === uname.toLowerCase())
          : data.logs;
        setUserLogs(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      setCurrentUserData(user);
      setSelectedUsername(user.username);
      fetchHistory(user.username);
    } else {
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUsername) {
      fetchHistory(selectedUsername);
    }
  }, [selectedUsername]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add new passkey (Item 1 in morong.md)
  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserData) {
      setMsg({ type: 'error', text: 'Vui lòng đăng nhập trước khi thêm Passkey mới.' });
      return;
    }
    setActionLoading(true);
    setMsg(null);

    try {
      const optRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUserData.username,
          displayName: currentUserData.displayName || currentUserData.username,
          authenticatorAttachment: deviceType === 'platform' ? 'platform' : undefined,
        }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData.error || 'Lỗi tạo tùy chọn đăng ký');

      const attResp = await startRegistration({ optionsJSON: optData.options });

      const defaultName = deviceType === 'platform' ? 'Windows Hello' : 'Smartphone';
      const verifRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUserData.username,
          response: attResp,
          deviceName: newDeviceName.trim() || defaultName,
        }),
      });

      const verifData = await verifRes.json();
      if (!verifRes.ok) throw new Error(verifData.error || 'Xác minh khóa thất bại');

      setMsg({ type: 'success', text: 'Đã thêm Passkey mới thành công!' });
      setAddingDevice(false);
      setNewDeviceName('');
      onRefreshUser();
      fetchHistory(currentUserData.username);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi thêm thiết bị' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Passkey (Item 1 in morong.md)
  const handleDeletePasskey = async (credentialId: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi (xóa) Passkey này khỏi tài khoản?')) return;
    setActionLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa Passkey');

      setMsg({ type: 'success', text: 'Đã thu hồi Passkey thành công.' });
      onRefreshUser();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi khi xóa Passkey' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Account (Item 2 in morong.md)
  const handleDeleteAccount = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa tài khoản');
      alert('Tất cả Passkey của tài khoản đã bị thu hồi. Tài khoản đã bị xóa.');
      setShowDeleteModal(false);
      onLogout();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi khi xóa tài khoản' });
      setShowDeleteModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const credentials = currentUserData?.credentials || [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Alert Notification */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. TRANG THÔNG TIN TÀI KHOẢN (ACCOUNT) - Mục 2 trong morong.md */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#18483D] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-[#0A1A17] flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
                ACCOUNT
              </div>
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                Tài khoản: {currentUserData ? `@${currentUserData.username}` : 'Chưa đăng nhập'}
              </h2>
            </div>
          </div>

          {currentUserData && (
            <div className="flex items-center gap-2">
              <button
                onClick={onLogout}
                className="px-3.5 py-1.5 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#F8FAFC] text-xs font-semibold border border-[#1A574A] transition-all"
              >
                Đăng Xuất
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-500/40 transition-all"
              >
                Xóa Tài Khoản
              </button>
            </div>
          )}
        </div>

        {currentUserData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-[#081C17] border border-[#195042]">
              <div className="text-[#94A3B8] text-[11px]">Username:</div>
              <div className="font-bold text-[#F8FAFC] mt-0.5">{currentUserData.username}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#081C17] border border-[#195042]">
              <div className="text-[#94A3B8] text-[11px]">Tên hiển thị:</div>
              <div className="font-bold text-[#CBD5E1] mt-0.5">{currentUserData.displayName || currentUserData.username}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#081C17] border border-[#195042]">
              <div className="text-[#94A3B8] text-[11px]">Passkeys:</div>
              <div className="font-bold text-[#F59E0B] text-base mt-0.5">{credentials.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#081C17] border border-[#195042]">
              <div className="text-[#94A3B8] text-[11px]">Last login:</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                {currentUserData.credentials?.[0]?.lastUsedAt
                  ? new Date(currentUserData.credentials[0].lastUsedAt).toLocaleTimeString('vi-VN')
                  : 'Vừa xong'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#081C17] border border-[#195042] text-xs text-[#A7C2BC]">
            Bạn chưa đăng nhập. Hãy chuyển sang tab <strong>Xác Thực FIDO2</strong> để đăng nhập hoặc đăng ký tài khoản mới bằng Windows Hello / Điện thoại.
          </div>
        )}
      </div>

      {/* 1. QUẢN LÝ PASSKEY / THIẾT BỊ (MY DEVICES) - Mục 1 & 10 trong morong.md */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18483D] pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-[#F59E0B]">
              PASSKEYS / MY DEVICES
            </div>
            <h3 className="text-base font-bold text-[#F8FAFC]">
              Danh Sách Thiết Bị & Khóa Bảo Mật FIDO2
            </h3>
            <p className="text-[11px] text-[#A7C2BC] mt-0.5">
              Backend lưu: credentialId, publicKey, signCount, userId, createdAt, lastUsedAt. <strong>Không lưu Private Key!</strong>
            </p>
          </div>

          {currentUserData && (
            <button
              onClick={() => setAddingDevice(!addingDevice)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/25 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Thêm Passkey</span>
            </button>
          )}
        </div>

        {/* Add Passkey Form */}
        {addingDevice && (
          <form
            onSubmit={handleAddPasskey}
            className="p-5 rounded-xl bg-[#081F19] border border-[#1C5D4E] space-y-4"
          >
            <div className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#F59E0B]" />
              Thêm Khóa Sinh Trắc Học / Passkey Mới
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#A7C2BC] font-semibold mb-1">Tên thiết bị nhận diện:</label>
                <input
                  type="text"
                  placeholder="VD: Windows Hello Laptop, iPhone 15 Pro..."
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-[#051410] border border-[#1A5043] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div>
                <label className="block text-[#A7C2BC] font-semibold mb-1">Loại thiết bị xác thực:</label>
                <select
                  value={deviceType}
                  onChange={(e: any) => setDeviceType(e.target.value)}
                  className="w-full bg-[#051410] border border-[#1A5043] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B]"
                >
                  <option value="platform">💻 Windows Hello (Mã PIN / Vân tay laptop)</option>
                  <option value="cross-platform">📱 Smartphone (Quét mã QR qua FaceID/Vân tay điện thoại)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-[#0A1A17] text-xs font-extrabold flex items-center gap-1.5 transition-all shadow"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                <span>Xác Thực & Thêm Passkey</span>
              </button>
              <button
                type="button"
                onClick={() => setAddingDevice(false)}
                className="px-3 py-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Passkeys List - formatted exactly like morong.md Item 1 */}
        <div className="space-y-4">
          {credentials.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-[#1C5246] text-[#64748B] text-xs">
              Chưa có Passkey nào được đăng ký cho tài khoản này.
            </div>
          ) : (
            credentials.map((cred: any, idx: number) => {
              const isPhone = cred.deviceName?.toLowerCase().includes('thoai') || cred.deviceName?.toLowerCase().includes('phone');
              const createdDate = cred.createdAt ? new Date(cred.createdAt).toLocaleDateString('vi-VN') : '07/10/2026';
              const lastUsedTime = cred.lastUsedAt ? new Date(cred.lastUsedAt).toLocaleTimeString('vi-VN') : '21:54';

              return (
                <div
                  key={cred.id || idx}
                  className="p-4 rounded-xl border border-[#18483D] bg-[#09241D] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#226757] transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-xl bg-[#061A14] text-[#F59E0B] border border-[#144236]">
                      {isPhone ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F8FAFC]">
                          {cred.deviceName || (isPhone ? 'Smartphone' : 'Windows Hello')}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0A2E25] text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      </div>

                      <div className="text-xs text-[#94A3B8]">
                        Platform Authenticator
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#A7C2BC] pt-1">
                        <div>Created: <span className="text-[#F8FAFC]">{createdDate}</span></div>
                        <div>Last used: <span className="text-emerald-400 font-bold">{lastUsedTime}</span></div>
                        <div>SignCount: <span className="text-[#F59E0B] font-bold">{cred.counter ?? 0}</span></div>
                      </div>

                      {/* Truncated Credential ID */}
                      <div className="text-[10px] font-mono text-[#64748B] flex items-center gap-2 pt-0.5">
                        <span className="truncate max-w-[280px]">ID: {cred.id}</span>
                        <button
                          onClick={() => copyText(cred.id, cred.id)}
                          className="text-[#F59E0B] hover:text-amber-300 flex items-center gap-1"
                        >
                          {copiedId === cred.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy ID
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={() => handleDeletePasskey(cred.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa Passkey</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 9. AUTHENTICATION HISTORY - Mục 9 trong morong.md */}
      <div className="p-6 rounded-2xl border border-[#1C5246] bg-[#0E352D] shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#18483D] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-wider">
              AUTHENTICATION HISTORY ({userLogs.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#A7C2BC]">
            Click một record ──► mở lại FIDO2 Inspector
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#17483D] bg-[#09221D]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#154439] bg-[#061914] text-[#94A3B8]">
                <th className="p-3">Time</th>
                <th className="p-3">Action</th>
                <th className="p-3">User</th>
                <th className="p-3">Device / Method</th>
                <th className="p-3 text-center">Result</th>
                <th className="p-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#133D33]">
              {userLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#64748B]">
                    Chưa có lịch sử xác thực nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                userLogs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  const timeStr = new Date(log.timestamp).toLocaleTimeString('vi-VN');
                  const isPhone = log.details?.toLowerCase().includes('phone') || log.credentialId?.length! > 60;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => onSelectLogForInspector(log.id)}
                      className="hover:bg-[#103E33] cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-[#CBD5E1]">{timeStr}</td>
                      <td className="p-3">
                        {log.action === 'REGISTRATION' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A2621] text-[#F59E0B] border border-[#19594D]">
                            Register
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#144A3E] text-emerald-300 border border-[#216B5A]">
                            Login
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[#F8FAFC] font-bold">@{log.username}</td>
                      <td className="p-3 text-[#A7C2BC]">
                        {log.action === 'REGISTRATION' ? 'Windows Hello / Pin' : 'Platform Passkey'}
                      </td>
                      <td className="p-3 text-center">
                        {isSuccess ? (
                          <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ✓
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> ✕
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLogForInspector(log.id);
                          }}
                          className="px-2.5 py-1 rounded bg-[#09241E] hover:bg-[#144B3D] text-[#F59E0B] text-[11px] font-bold border border-[#1C5B4E] transition-all"
                        >
                          Mở Inspector ──►
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Account Modal - Mục 2 trong morong.md */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0E241E] border border-rose-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Bạn có chắc chắn?</h3>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Tất cả Passkey của tài khoản <strong className="text-white">@{currentUserData?.username}</strong> sẽ bị thu hồi vĩnh viễn khỏi máy chủ.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-[#09221D] hover:bg-[#113B32] text-[#94A3B8] text-xs font-semibold border border-[#1A574A]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30"
              >
                {actionLoading ? 'Đang Xóa...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
