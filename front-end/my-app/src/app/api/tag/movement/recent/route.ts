// src/app/api/tag/movement/recent/route.ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request:Request) {
    try{
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('orgId') || '10';
        const limit = searchParams.get('limit') || '100';

        const res = await fetch(
            `${BACKEND_URL}/api/tag-movement/recent?orgId=${orgId}&limit=${limit}`,
            { cache: 'no-store'}
        );

        if (!res.ok) {
            throw new Error(`Backend error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json(
            {error: 'Failed to fetch movements', movements: []},
            {status: 500}
        );
    }
    
}