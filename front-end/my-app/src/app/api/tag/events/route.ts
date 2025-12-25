// src/app/api/tag/events/route.ts
import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/tag/events`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const events = await res.json();
    
    return NextResponse.json({ 
      events: Array.isArray(events) ? events : [],
      count: Array.isArray(events) ? events.length : 0,
    });

  } catch (error) {
    console.error('[API /api/tag/events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [], count: 0 },
      { status: 500 }
    );
  }
}