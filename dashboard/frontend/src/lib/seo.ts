import { SITE_URL } from '../components/landing/site'

export const SITE_NAME = 'WorkforceGuard AI'
export const SITE_LOCALE = 'en_GB'

export const DEFAULT_TITLE =
  'WorkforceGuard AI — EU Pay Transparency Compliance & Workforce Intelligence'

export const DEFAULT_DESCRIPTION =
  'WorkforceGuard AI helps EU employers prepare for Directive (EU) 2023/970 with gender pay gap benchmarking across the EU27, payroll-aware compliance review, and a hash-chained audit log ready for regulators.'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export const SITE_KEYWORDS = [
  'EU Pay Transparency Directive',
  'Directive EU 2023/970',
  'gender pay gap reporting',
  'EU27 pay gap benchmarking',
  'pay transparency compliance',
  'workforce intelligence',
  'Eurostat labour analytics',
  'joint pay assessment',
  'HR compliance software',
  'people analytics EU',
].join(', ')

export type FaqItem = { q: string; a: string }

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    description: DEFAULT_DESCRIPTION,
  }
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-GB',
  }
}

export function buildSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
  }
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }
}

export function buildWebPageSchema({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    inLanguage: 'en-GB',
  }
}

export function buildHomeJsonLd(faqs: FaqItem[]) {
  return [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildSoftwareApplicationSchema(),
    buildFaqSchema(faqs),
  ]
}