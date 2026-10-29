import type { ComposeOutput, CvAiOutput, Fact } from '../../src/ai/cv-ai.js';

/** What a scripted extract returns for the sample Source. */
export function extractOutput(): CvAiOutput<'extract'> {
  return {
    facts: [
      { text: 'Name is Ada Lovelace', quote: 'Ada Lovelace' },
      { text: 'Email is ada@example.com', quote: 'ada@example.com' },
      {
        text: 'Backend engineer at Analytical Engines Ltd since 2019',
        quote: 'Backend engineer at Analytical Engines Ltd since 2019',
      },
      {
        text: 'Built the billing service in Node.js',
        quote: 'built the billing service in Node.js',
      },
    ],
  };
}

/** The Facts the pipeline stores for {@link extractOutput} of a text Source. */
export function sampleFacts(): Fact[] {
  return extractOutput().facts.map((fact, index) => ({
    id: `f${index + 1}`,
    ...fact,
    source: 'text',
  }));
}

/** A compose result that passes the structural check against {@link sampleFacts}. */
export function composeOutput(): ComposeOutput {
  return {
    contact: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      location: null,
      links: [],
      sourceFactIds: ['f1', 'f2'],
    },
    summary: {
      text: 'Backend engineer who built a billing service in Node.js.',
      sourceFactIds: ['f3', 'f4'],
    },
    experience: [
      {
        organization: 'Analytical Engines Ltd',
        title: 'Backend Engineer',
        startDate: '2019',
        endDate: 'present',
        location: null,
        bullets: [
          {
            text: 'Built the billing service in Node.js.',
            sourceFactIds: ['f4'],
          },
        ],
        sourceFactIds: ['f3'],
      },
    ],
    education: [],
    skills: [{ name: 'Node.js', sourceFactIds: ['f4'] }],
    questions: [],
  };
}

/** A judge that finds every Assertion supported. */
export function noFindings(): CvAiOutput<'judge'> {
  return { findings: [] };
}
