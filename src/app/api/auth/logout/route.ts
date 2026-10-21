import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Đăng xuất thành công' });
  res.cookies.delete('nt101_session');
  res.cookies.delete('nt101_auth_challenge');
  return res;
}
