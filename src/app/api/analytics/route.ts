import { NextResponse } from "next/server";
import { analyticsService } from "@/lib/services/analytics/analytics-service";
import { withDb } from "@/lib/api";

export async function GET() {
  return withDb(async () => {
  const [kpis, contactsByCompany, topDomains, statusBreakdown, outreachProgress, importHistory, missingData, rates] =
    await Promise.all([
      analyticsService.getKpis(),
      analyticsService.getContactsByCompany(),
      analyticsService.getTopDomains(),
      analyticsService.getStatusBreakdown(),
      analyticsService.getOutreachProgress(),
      analyticsService.getImportHistory(),
      analyticsService.getMissingData(),
      analyticsService.getRates(),
    ]);

  return NextResponse.json({
    kpis,
    contactsByCompany,
    topDomains,
    statusBreakdown,
    outreachProgress,
    importHistory,
    missingData,
    rates,
  });
  });
}
