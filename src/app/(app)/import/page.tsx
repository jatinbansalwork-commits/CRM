import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/layout/page-header";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Import"
        description="Paste from Google Sheets, Excel, or Airtable — or upload CSV/XLSX. The smart engine detects columns automatically."
      />
      <ImportWizard />
    </div>
  );
}
