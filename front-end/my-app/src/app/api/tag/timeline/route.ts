// src/app/api/tag/timeline/route.ts
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // รับ query parameter limit
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    const res = await fetch(`${BACKEND_URL}/api/tag/timeline?limit=${limit}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const timeline = await res.json();
    
    return NextResponse.json({ 
      timeline: Array.isArray(timeline) ? timeline : [],
      count: Array.isArray(timeline) ? timeline.length : 0,
    });

  } catch (error) {
    console.error('[API /api/tag/timeline] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline', timeline: [], count: 0 },
      { status: 500 }
    );
  }
}