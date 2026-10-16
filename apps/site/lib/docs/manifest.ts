export const SITE_URL = "https://aislerun.vercel.app";
export const API_URL = "https://aislerun.158-220-85-120.sslip.io";
export const INTRODUCTION_SLUG = "introduction";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
}

export interface DocSection {
  title: string;
  pages: readonly DocPage[];
}

export const DOC_SECTIONS: readonly DocSection[] = [
  {
    title: "Start here",
    pages: [
      {
        slug: INTRODUCTION_SLUG,
        title: "What is AisleRun",
        description: "A shopper test an AI agent can order: one paid browser run that shops a product page on a phone and a desktop and stops at checkout.",
      },
      {
        slug: "quickstart",
        title: "Order your first run",
        description: "Get a quote, pay for the run through PayBox, and read the result, with the exact requests an agent sends.",
      },
      {
        slug: "how-it-works",
        title: "How a run works",
        description: "What happens between the quote and the report: the payment gate, the worker, the browser journey and where evidence is kept.",
      },
    ],
  },
  {
    title: "Using AisleRun",
    pages: [
      {
        slug: "quotes",
        title: "Quotes",
        description: "Ask what a run costs and what it covers before anything is charged, and how a quote binds the paid request to it.",
      },
      {
        slug: "paying-with-paybox",
        title: "Paying with PayBox",
        description: "How PayBox pays the x402 request, what the agent gets back, and what happens when a payment fails or is retried.",
      },
      {
        slug: "reading-results",
        title: "Reading results",
        description: "Poll the run, read its event stream, and open the report with recordings, screenshots and traces.",
      },
      {
        slug: "verdicts",
        title: "Verdicts and blockers",
        description: "What pass, fail and inconclusive mean, every blocker code, and why a service error never counts against the store.",
      },
      {
        slug: "retests",
        title: "Retests and comparisons",
        description: "Pay for a second run after a fix and compare the two side by side, recording against recording.",
      },
    ],
  },
  {
    title: "Safety and trust",
    pages: [
      {
        slug: "authorized-stores",
        title: "Authorized stores",
        description: "Which stores AisleRun will test, why a public URL isn't permission, and how the browser is fenced off from everything else.",
      },
      {
        slug: "payments-and-refunds",
        title: "Payments, retries and refunds",
        description: "The price, when money moves, how a retried request avoids a second charge, and what happens to a payment if a run fails.",
      },
      {
        slug: "privacy-and-evidence",
        title: "Privacy and evidence",
        description: "Who can read a report, how long evidence links last, what is published, and what AisleRun never collects.",
      },
      {
        slug: "limitations",
        title: "Limitations",
        description: "What a run can't tell you, and the things AisleRun doesn't do yet.",
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        slug: "api",
        title: "API",
        description: "Base URL, every endpoint, request and response shapes, read tokens and the error codes.",
      },
      {
        slug: "test-store",
        title: "The test store",
        description: "AisleRun's own labelled fixture store, its four versions and the seeded defect.",
      },
      {
        slug: "proof",
        title: "Live proof",
        description: "Every paid run so far, with its settlement on Base and what the browser found.",
      },
      {
        slug: "faq",
        title: "FAQ",
        description: "Direct answers to the questions people ask about AisleRun, PayBox and the results.",
      },
      {
        slug: "glossary",
        title: "Glossary",
        description: "Plain-word definitions of the terms in the app and these docs.",
      },
    ],
  },
];

export interface IndexedDocPage extends DocPage {
  section: string;
  path: string;
  url: string;
}

export const DOC_PAGES: readonly IndexedDocPage[] = DOC_SECTIONS.flatMap((section) =>
  section.pages.map((page) => {
    const path = docPath(page.slug);
    return { ...page, section: section.title, path, url: `${SITE_URL}${path}` };
  }),
);

export function docPath(slug: string): string {
  return slug === INTRODUCTION_SLUG ? "/docs" : `/docs/${slug}`;
}

export function findDocPage(slug: string): IndexedDocPage | undefined {
  return DOC_PAGES.find((page) => page.slug === slug);
}
