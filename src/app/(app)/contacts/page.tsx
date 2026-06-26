import { ContactsTable } from "@/components/contacts/contacts-table";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Search, filter, and track outreach across your recruiter and HR network."
        actions={
          <Link href="/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Link>
        }
      />
      <ContactsTable />
    </div>
  );
}
