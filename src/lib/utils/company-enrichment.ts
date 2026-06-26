const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "mail.com",
  "ymail.com",
  "rocketmail.com",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
  "yandex.com",
  "mail.ru",
  "qq.com",
  "163.com",
  "126.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
]);

const MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.jp",
  "com.br",
  "com.mx",
  "co.in",
  "com.sg",
]);

/** Well-known domains → display name */
const KNOWN_COMPANY_DOMAINS: Record<string, string> = {
  "google.com": "Google",
  "microsoft.com": "Microsoft",
  "amazon.com": "Amazon",
  "apple.com": "Apple",
  "meta.com": "Meta",
  "facebook.com": "Meta",
  "linkedin.com": "LinkedIn",
  "netflix.com": "Netflix",
  "stripe.com": "Stripe",
  "salesforce.com": "Salesforce",
  "adobe.com": "Adobe",
  "oracle.com": "Oracle",
  "ibm.com": "IBM",
  "intel.com": "Intel",
  "nvidia.com": "NVIDIA",
  "uber.com": "Uber",
  "airbnb.com": "Airbnb",
  "spotify.com": "Spotify",
  "twitter.com": "X",
  "x.com": "X",
};

const GENERIC_MAIL_SUBDOMAINS = new Set([
  "mail",
  "email",
  "smtp",
  "mx",
  "corp",
  "careers",
  "jobs",
  "hr",
  "recruiting",
]);

function domainFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");
  return parts.length === 2 ? parts[1] : null;
}

export type CompanyEnrichment = {
  company: string | null;
  domain: string | null;
  enriched: boolean;
  reason: "existing" | "personal" | "known" | "domain" | "none";
};

function formatCompanySlug(slug: string): string {
  const cleaned = slug.replace(/[^a-z0-9-_]/gi, "").trim();
  if (!cleaned) return "";

  if (cleaned.length <= 3) return cleaned.toUpperCase();

  return cleaned
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Extract the registrable company slug from a hostname (e.g. acme.co.uk → acme). */
export function getCompanySlugFromDomain(domain: string): string | null {
  const normalized = domain.toLowerCase().trim().replace(/\.$/, "");
  if (!normalized || PERSONAL_EMAIL_DOMAINS.has(normalized)) return null;

  if (KNOWN_COMPANY_DOMAINS[normalized]) {
    return KNOWN_COMPANY_DOMAINS[normalized];
  }

  const parts = normalized.split(".").filter(Boolean);
  if (parts.length < 2) return null;

  const lastTwo = parts.slice(-2).join(".");
  let slug: string;

  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    slug = parts[parts.length - 3] ?? "";
  } else {
    slug = parts[parts.length - 2] ?? "";
  }

  if (GENERIC_MAIL_SUBDOMAINS.has(slug) && parts.length >= 3) {
    const parent = parts[parts.length - 3] ?? "";
    if (parent && !GENERIC_MAIL_SUBDOMAINS.has(parent)) {
      slug = parent;
    }
  }

  const formatted = formatCompanySlug(slug);
  return formatted || null;
}

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase().trim());
}

/** Infer employer company name from a work email address. */
export function inferCompanyFromEmail(email: string): CompanyEnrichment {
  const domain = domainFromEmail(email);
  if (!domain) {
    return { company: null, domain: null, enriched: false, reason: "none" };
  }

  if (isPersonalEmailDomain(domain)) {
    return { company: null, domain, enriched: false, reason: "personal" };
  }

  if (KNOWN_COMPANY_DOMAINS[domain]) {
    return {
      company: KNOWN_COMPANY_DOMAINS[domain],
      domain,
      enriched: true,
      reason: "known",
    };
  }

  const company = getCompanySlugFromDomain(domain);
  if (company) {
    return { company, domain, enriched: true, reason: "domain" };
  }

  return { company: null, domain, enriched: false, reason: "none" };
}

export function enrichRowCompany<T extends { company?: string; email?: string }>(
  row: T,
): T & { companyEnriched?: boolean } {
  if (row.company?.trim()) {
    return { ...row, companyEnriched: false };
  }

  if (!row.email?.trim()) {
    return { ...row, companyEnriched: false };
  }

  const { company, enriched } = inferCompanyFromEmail(row.email);
  if (!company) {
    return { ...row, companyEnriched: false };
  }

  return {
    ...row,
    company,
    companyEnriched: enriched,
  };
}
