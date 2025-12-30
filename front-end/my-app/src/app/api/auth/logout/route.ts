// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    // บอก backend ให้ revoke token
    if (refreshToken) {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `refresh_token=${refreshToken}`,
        },
      });
    }

    // ลบ cookie
    const res = NextResponse.json({ message: 'Logout สำเร็จ' });
    res.cookies.delete('refresh_token');

    return res;
  } catch (error) {
    console.error('Logout error:', error);
    
    // ลบ cookie แม้ว่าจะ error
    const res = NextResponse.json({ message: 'Logout สำเร็จ' });
    res.cookies.delete('refresh_token');
    
    return res;
  }
}