import { NextResponse } from "next/server";
import { activityService } from "@/lib/services/activity/activity-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await activityService.findMany({
    cursor: searchParams.get("cursor") ?? undefined,
    take: parseInt(searchParams.get("take") ?? "50", 10),
    action: searchParams.get("action") ?? undefined,
  });
  return NextResponse.json(result);
}
