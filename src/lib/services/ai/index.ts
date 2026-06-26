import type { MergeSuggestion } from "@/types";
import { normalizeCompanyName, fuzzyMatch } from "@/lib/utils/contact";
import { detectRoleCategory } from "@/lib/utils/contact";
import { companyFromDomain, extractDomain } from "@/lib/utils/contact";
import type { ContactWithCompany } from "@/types";

export interface AICompanyNormalizer {
  suggestMerge(names: string[]): MergeSuggestion[];
}

export interface AIDuplicateDetector {
  findLikelyDuplicates(contacts: ContactWithCompany[]): { key: string; items: ContactWithCompany[] }[];
}

export interface AIRoleTagger {
  detectRole(title: string): string[];
}

export interface AIEmailGenerator {
  generateColdEmail(contact: ContactWithCompany): Promise<string>;
}

export interface AIEnricher {
  enrichFromEmail(email: string): Promise<Partial<ContactWithCompany>>;
}

export interface AIContactSuggester {
  suggestNextContacts(criteria: {
    notContacted?: boolean;
    followUpDue?: boolean;
    limit?: number;
  }): Promise<ContactWithCompany[]>;
}

export class RuleBasedCompanyNormalizer implements AICompanyNormalizer {
  suggestMerge(names: string[]): MergeSuggestion[] {
    const groups: MergeSuggestion[] = [];
    const used = new Set<string>();

    for (let i = 0; i < names.length; i++) {
      if (used.has(names[i])) continue;
      const variants = [names[i]];
      for (let j = i + 1; j < names.length; j++) {
        if (fuzzyMatch(names[i], names[j])) {
          variants.push(names[j]);
          used.add(names[j]);
        }
      }
      if (variants.length > 1) {
        groups.push({
          canonical: normalizeCompanyName(variants[0]),
          variants,
          confidence: 0.7,
        });
      }
      used.add(names[i]);
    }
    return groups;
  }
}

export class RuleBasedRoleTagger implements AIRoleTagger {
  detectRole(title: string): string[] {
    const category = detectRoleCategory(title);
    return category !== "Other" ? [category] : [];
  }
}

export class RuleBasedEnricher implements AIEnricher {
  async enrichFromEmail(email: string): Promise<Partial<ContactWithCompany>> {
    const domain = extractDomain(email);
    if (!domain) return { email };
    return {
      email,
      domain,
      website: `https://${domain}`,
      company: { id: "", name: companyFromDomain(domain), domain },
    } as Partial<ContactWithCompany>;
  }
}

export class StubEmailGenerator implements AIEmailGenerator {
  async generateColdEmail(): Promise<string> {
    throw new Error("AI email generation is not configured. Add an API key in settings.");
  }
}

export class StubContactSuggester implements AIContactSuggester {
  async suggestNextContacts(): Promise<ContactWithCompany[]> {
    throw new Error("AI contact suggestions are not configured.");
  }
}

export const aiServices = {
  companyNormalizer: new RuleBasedCompanyNormalizer(),
  roleTagger: new RuleBasedRoleTagger(),
  enricher: new RuleBasedEnricher(),
  emailGenerator: new StubEmailGenerator(),
  contactSuggester: new StubContactSuggester(),
};
