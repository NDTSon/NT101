import { NextRequest, NextResponse } from 'next/server';
import { findUserById, deleteUser, updateDisplayName } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('nt101_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    let sessionData: { userId?: string } = {};
    try {
      sessionData = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: 'Phiên không hợp lệ' }, { status: 400 });
    }

    if (!sessionData.userId) {
      return NextResponse.json({ error: 'Không tìm thấy User ID' }, { status: 400 });
    }

    const user = await findUserById(sessionData.userId);
    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    await deleteUser(user.id);

    const res = NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản @${user.username} và thu hồi toàn bộ ${user.credentials.length} Passkeys`,
    });

    res.cookies.delete('nt101_session');
    res.cookies.delete('nt101_auth_challenge');
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi khi xóa tài khoản' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('nt101_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { displayName } = await req.json();
    if (!displayName || !displayName.trim()) {
      return NextResponse.json({ error: 'Tên hiển thị không được để trống' }, { status: 400 });
    }

    const sessionData = JSON.parse(sessionCookie);
    const updated = await updateDisplayName(sessionData.userId, displayName.trim());

    if (!updated) {
      return NextResponse.json({ error: 'Không thể cập nhật tên' }, { status: 404 });
    }

    return NextResponse.json({ success: true, displayName: displayName.trim() });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi cập nhật' }, { status: 500 });
  }
}
