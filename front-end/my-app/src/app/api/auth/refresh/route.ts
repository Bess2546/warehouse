// src/app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': refreshToken ? `refresh_token=${refreshToken}` : '',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // ลบ cookie ถ้า refresh ไม่สำเร็จ
      const res = NextResponse.json(data, { status: response.status });
      res.cookies.delete('refresh_token');
      return res;
    }

    // สร้าง response พร้อม set cookie ใหม่
    const res = NextResponse.json({
      access_token: data.access_token,
      user: data.user,
    });

    // Set new refresh token cookie
    if (data.refresh_token) {
      res.cookies.set('refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }

    return res;
  } catch (error) {
    console.error('Refresh error:', error);
    const res = NextResponse.json(
      { message: 'Refresh failed' },
      { status: 401 }
    );
    res.cookies.delete('refresh_token');
    return res;
  }
}