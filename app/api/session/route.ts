import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  try {
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const response = NextResponse.json({ success: true });

    response.cookies.set("userId", userId, {
      httpOnly: true,
      maxAge: expiresIn / 1000,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Token verification failed", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
