import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");

    const { data, error } = await ctx.supabase
      .from("roles")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("rank", { ascending: false });

    if (error) {
      console.error("[GET /api/account/roles] fetch error:", error);
      return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
    }

    return NextResponse.json({ roles: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("owner");
    const body = await request.json();
    const { name, rank, permissions } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (typeof rank !== "number" || rank < 1 || rank > 10) {
      return NextResponse.json({ error: "Rank must be between 1 and 10" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("roles")
      .insert({
        account_id: ctx.accountId,
        name: name.trim(),
        rank,
        is_system: false,
        permissions: permissions ?? {},
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/account/roles] insert error:", error);
      return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
    }

    return NextResponse.json({ role: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
