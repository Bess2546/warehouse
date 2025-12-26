// src/app/api/tag/movement/summary/route.ts

import { NextResponse } from "next/server";
import { URL } from "url";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('orgId') || '10';

        const res = await fetch(
            `${BACKEND_URL}/api/tag-movment/summary?orgId=${orgId}`,
            { cache: 'no-store'}
        );

        if (!res.ok){
            throw new Error(`Backend error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:',error);
        return NextResponse.json(
            {
                error: 'Failed to fetch summary',
                totalMovements: 0,
                totalIn: 0,
                totalOut: 0,
                todayMovements: 0
            },
            { status: 500}
        );
        
    }
}