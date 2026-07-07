import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole("owner");
    const { id } = await params;
    const body = await request.json();
    const { name, rank, permissions } = body;

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (rank !== undefined) update.rank = rank;
    if (permissions !== undefined) update.permissions = permissions;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("roles")
      .update(update)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select()
      .single();

    if (error) {
      console.error("[PUT /api/account/roles/[id]] update error:", error);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    return NextResponse.json({ role: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole("owner");
    const { id } = await params;

    const { error } = await ctx.supabase
      .from("roles")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .eq("is_system", false);

    if (error) {
      console.error("[DELETE /api/account/roles/[id]] delete error:", error);
      return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
