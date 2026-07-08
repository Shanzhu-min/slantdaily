import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PageHeading, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

const contactEmail = 'contact@slantdaily.com';

const sections = [
  {
    title: 'Site Content',
    body: `Daily Slant, including its page design, written content, guide articles, printable puzzle layouts, interface text, and original puzzle presentation, is protected by applicable copyright and intellectual property laws.

You may use the site for personal puzzle play, learning, and printing. You may not copy, sell, repackage, scrape at scale, or redistribute Daily Slant content as a competing product without permission.`
  },
  {
    title: 'Puzzle Rules and Tradition',
    body: `Slant is also known in puzzle communities as Gokigen Naname. The general idea of drawing diagonals to satisfy numbered intersection clues belongs to the broader logic puzzle tradition.

This copyright notice covers Daily Slant's original implementation, generated puzzle bank, text, layout, code, and site-specific presentation.`
  },
  {
    title: 'Permitted Personal Use',
    body: `You may print puzzles for your own practice, classroom-style use, or casual sharing. Please keep Daily Slant attribution visible when sharing printed materials.

Commercial republication, automated copying, bulk redistribution, or use of Daily Slant content in another product requires prior written permission.`
  },
  {
    title: 'Contact',
    body: `For copyright questions, permission requests, or takedown concerns, contact us at ${contactEmail}. Please include the relevant URL, a clear description of the issue, and your contact details.`
  }
];

export const metadata: Metadata = {
  title: 'Copyright | Daily Slant',
  description: 'Read the Daily Slant copyright notice for site content, puzzle presentation, printable pages, and guide articles.'
};

export default async function CopyrightPage() {
  const messages = await getAppMessages();

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        eyebrow="Legal"
        hero={{
          title: 'Copyright',
          subtitle: 'Copyright notice for Daily Slant content and printable puzzle materials.'
        }}
      />
      <section className="static-page-content" aria-label="Copyright details">
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
