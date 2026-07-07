import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PageHeading, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

const contactEmail = 'FrankAnqg@gmail.com';

const sections = [
  {
    title: 'Acceptance of These Terms',
    body: `By using Daily Slant, you agree to these Terms of Use. If you do not agree, please do not use the site.

Daily Slant is a browser-based logic puzzle site that provides daily challenges, practice puzzles, archive play, printable puzzles, achievements, and guide content.`
  },
  {
    title: 'Use of the Site',
    body: `You may use the site for personal, non-commercial puzzle play, learning, and printing. You agree not to interfere with the site, overload its systems, scrape it at unreasonable volume, attempt to bypass technical protections, or use the site for unlawful purposes.

You are responsible for your own device, browser settings, and internet connection. Some features may depend on local browser storage or a generated session identifier.`
  },
  {
    title: 'Puzzle Records and Progress',
    body: `The site may record puzzle loads, daily completions, practice completions, elapsed time, move count, difficulty, and puzzle seed. These records are used to run gameplay features such as archive status, achievements, and puzzle statistics.

We may change puzzle selection, scoring displays, achievements, archive availability, or practice behavior as the product develops.`
  },
  {
    title: 'Printable Puzzles and Guide Content',
    body: `Printable puzzle pages and guide articles are provided for personal use. You may print puzzles for your own practice, classroom-style use, or casual sharing, but you may not sell, repackage, or redistribute site content as a competing product without permission.`
  },
  {
    title: 'Intellectual Property',
    body: `Daily Slant, the page designs, text, code, generated puzzle bank, and site content are protected by applicable intellectual property laws. Some puzzle rule concepts are part of the broader Slant or Gokigen Naname puzzle tradition, but this site's implementation, presentation, and content belong to the site owner or its licensors.`
  },
  {
    title: 'No Warranty',
    body: `The site is provided as is and as available. We try to keep puzzles playable and data accurate, but we do not guarantee uninterrupted service, error-free content, permanent availability of any puzzle, or that every feature will work on every device or browser.`
  },
  {
    title: 'Limitation of Liability',
    body: `To the fullest extent permitted by law, Daily Slant and its operator will not be liable for indirect, incidental, consequential, special, or punitive damages arising from your use of the site.

Your use of the site is at your own discretion. If you are unhappy with the site, your remedy is to stop using it.`
  },
  {
    title: 'Changes and Contact',
    body: `We may update these Terms of Use as the site changes. Continued use of the site after changes means you accept the updated terms.

Questions about these terms can be sent to ${contactEmail}.`
  }
];

export const metadata: Metadata = {
  title: 'Terms of Use | Daily Slant',
  description: 'Read the Daily Slant terms of use for puzzle play, printable content, guide content, and site access.'
};

export default async function TermsOfServicePage() {
  const messages = await getAppMessages();

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        eyebrow="Legal"
        hero={{
          title: 'Terms of Service',
          subtitle: 'Effective date: July 7, 2026'
        }}
      />
      <section className="static-page-content" aria-label="Terms of use details">
        {sections.map((section) => (
          <article className="section-card" key={section.title}>
            <h2>{section.title}</h2>
            <TextBlock text={section.body} />
          </article>
        ))}
      </section>
    </SiteLayout>
  );
}
