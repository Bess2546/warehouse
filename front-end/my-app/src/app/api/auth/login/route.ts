import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  // ส่งข้อมูลไปเช็คกับ NestJS backend
  const res = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" }
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ message: "Login failed" }, { status: 401 });
  }

  // ตั้ง cookie
  const response = NextResponse.json({ message: "OK" });
  response.cookies.set("token", data.token, { httpOnly: true });

  return response;
}
