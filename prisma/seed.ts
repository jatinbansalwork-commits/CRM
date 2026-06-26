import { prisma, initFts, syncContactToFts } from "../src/lib/db";

const companies = [
  { name: "Google", domain: "google.com", website: "https://google.com", industry: "Technology" },
  { name: "Microsoft", domain: "microsoft.com", website: "https://microsoft.com", industry: "Technology" },
  { name: "Stripe", domain: "stripe.com", website: "https://stripe.com", industry: "Fintech" },
  { name: "Meta", domain: "meta.com", website: "https://meta.com", industry: "Technology" },
  { name: "Apple", domain: "apple.com", website: "https://apple.com", industry: "Technology" },
];

const contacts = [
  { name: "Jane Smith", email: "jane.smith@google.com", role: "Technical Recruiter", company: "Google", status: "CONTACTED" as const, emailed: true },
  { name: "John Doe", email: "john.doe@microsoft.com", role: "HR Business Partner", company: "Microsoft", status: "REPLIED" as const, emailed: true },
  { name: "Alex Chen", email: "alex@stripe.com", role: "Talent Acquisition Lead", company: "Stripe", status: "INTERVIEW" as const, emailed: true },
  { name: "Sarah Wilson", email: "sarah.wilson@meta.com", role: "Hiring Manager", company: "Meta", status: "NOT_CONTACTED" as const },
  { name: "Mike Johnson", email: "mike.j@apple.com", role: "Senior Recruiter", company: "Apple", status: "OFFER" as const, emailed: true },
  { name: "Emily Davis", email: "emily.davis@google.com", role: "People Operations", company: "Google", status: "CONTACTED" as const, emailed: true },
  { name: "Chris Lee", email: "chris.lee@microsoft.com", role: "Engineering Manager", company: "Microsoft", status: "REJECTED" as const, emailed: true },
  { name: "Priya Patel", email: "priya@stripe.com", role: "Recruiter", company: "Stripe", status: "NOT_CONTACTED" as const },
];

async function main() {
  await initFts();

  const companyMap = new Map<string, string>();

  for (const c of companies) {
    let company = await prisma.company.findFirst({ where: { name: c.name } });
    if (!company) {
      company = await prisma.company.create({ data: c });
    }
    companyMap.set(c.name, company.id);
  }

  for (const ct of contacts) {
    const companyId = companyMap.get(ct.company);
    const existing = await prisma.contact.findUnique({ where: { email: ct.email } });
    if (!existing) {
      const contact = await prisma.contact.create({
        data: {
          name: ct.name,
          email: ct.email,
          role: ct.role,
          domain: ct.email.split("@")[1],
          companyId,
          status: ct.status,
          emailed: ct.emailed ?? false,
          priority: "MEDIUM",
          tags: "[]",
        },
        include: { company: true, notes: true },
      });
      await syncContactToFts(contact);
    }
  }

  await prisma.appSetting.upsert({
    where: { key: "defaults" },
    update: {},
    create: {
      key: "defaults",
      value: JSON.stringify({
        importRules: { skipInvalidEmails: true, mergeDuplicates: true, autoCreateCompanies: true },
        mergeRules: { stripSuffixes: ["LLC", "Inc", "Ltd", "Corp"], caseInsensitive: true },
        theme: "dark",
      }),
    },
  });

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
