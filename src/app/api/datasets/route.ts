import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
      return NextResponse.json(
        { error: "No active organization." },
        { status: 400 },
      );
    await requireOrganizationPermission(organizationId, { dataset: ["read"] });
    const input = schema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const rows = await prisma.dataset.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: {
        id: true,
        name: true,
        status: true,
        rowCount: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return NextResponse.json({
      items: items.map(serialize),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid pagination cursor."
            : "Unable to load datasets.",
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
const serialize = (item: {
  id: string;
  name: string;
  status: string;
  rowCount: bigint | null;
  sizeBytes: bigint | null;
  createdAt: Date;
}) => ({
  ...item,
  rowCount: item.rowCount?.toString() ?? null,
  sizeBytes: item.sizeBytes?.toString() ?? null,
  createdAt: item.createdAt.toISOString(),
});
