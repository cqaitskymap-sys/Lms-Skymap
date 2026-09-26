import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrBuildExamLeaderboard } from "@/lib/assessments/server";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";

/** Authenticated slim leaderboard. Does not expose raw exam_results documents. */
export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const examId = request.nextUrl.searchParams.get("examId")?.trim();
  if (!examId) {
    return NextResponse.json({ success: false, error: "examId is required" }, { status: 400 });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "20");
  const topN = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;

  try {
    const entries = await getOrBuildExamLeaderboard(examId, topN);
    return NextResponse.json({ success: true, entries });
  } catch (err) {
    console.error("[assessments/leaderboard]", err);
    return NextResponse.json(
      { success: false, error: "Could not load the leaderboard" },
      { status: 500 }
    );
  }
}
