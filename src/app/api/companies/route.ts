import { NextResponse } from "next/server";
import { companyRepository } from "@/lib/repositories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await companyRepository.findMany({
    cursor: searchParams.get("cursor") ?? undefined,
    take: parseInt(searchParams.get("take") ?? "50", 10),
    search: searchParams.get("search") ?? undefined,
  });
  const response = NextResponse.json(result);
  if (searchParams.get("search")) {
    response.headers.set("Cache-Control", "private, max-age=10");
  }
  return response;
}
