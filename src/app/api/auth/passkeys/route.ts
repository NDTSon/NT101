import { NextRequest, NextResponse } from 'next/server';
import { deletePasskey, findUserById } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('nt101_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { credentialId } = await req.json();
    if (!credentialId) {
      return NextResponse.json({ error: 'Thiếu ID khóa bảo mật cần xóa' }, { status: 400 });
    }

    const session = JSON.parse(sessionCookie);
    const user = await findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    const success = await deletePasskey(user.id, credentialId);
    if (!success) {
      return NextResponse.json({ error: 'Không tìm thấy khóa bảo mật cần xóa' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa khóa bảo mật thành công' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi khi xóa khóa' }, { status: 500 });
  }
}
