// src/app/api/tag/summary/route.ts
import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/tag/summary`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const summary = await res.json();
    
    return NextResponse.json(summary);

  } catch (error) {
    console.error('[API /api/tag/summary] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch summary',
        present_count: 0,
        total_tags: 0,
        by_zone: {},
        last24h: { scans: 0 },
      },
      { status: 500 }
    );
  }
}