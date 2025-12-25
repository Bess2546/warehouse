// src/app/api/tag/route.ts
import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    // ✅ แก้เป็น /api/tag/present (ไม่ใช่แค่ /api/tag)
    const res = await fetch(`${BACKEND_URL}/api/tag/present`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const tags = await res.json();
    
    return NextResponse.json({ 
      Tags: Array.isArray(tags) ? tags : [],
      count: Array.isArray(tags) ? tags.length : 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API /api/tag] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tags from backend',
        Tags: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}