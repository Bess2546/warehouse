// src/app/api/tag/present/route.ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
    try {
        const { searchParams }  = new URL(request.url);
        const orgId = searchParams.get('orgId');

        const url = orgId
            ? `${BACKEND_URL}/api/tag/present?orgId=${orgId}`
            : `${BACKEND_URL}/api/tag/present`;
        
        const res = await fetch(url, {
            cache: 'no-store',
            headers:{
                'Content-Type': 'application/json'
            },
        });

        if (!res.ok){
            throw new Error(`Backend error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:',error);
        return NextResponse.json(
            { error: 'Failed to fetch tags', Tags: []},
            {status: 500}
        );
    }
}