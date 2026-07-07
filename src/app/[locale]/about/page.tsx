import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PageHeading, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

const sections = [
  {
    title: 'What Daily Slant Is',
    body: `Daily Slant is a logic puzzle site built around Slant, also known as Gokigen Naname. Each puzzle asks you to place one diagonal line in every cell while matching numbered intersection clues and avoiding closed loops.

The site focuses on a simple daily ritual: open one puzzle, solve it cleanly, and come back tomorrow for a fresh board.`
  },
  {
    title: 'What You Can Do Here',
    body: `You can play the daily challenge, revisit past puzzles in the archive, practice by difficulty, print puzzle sheets, and read guides about rules and solving patterns.

The current difficulty levels are easy, medium, and hard. The puzzle bank is designed so boards are loaded from stored seeds instead of generated randomly in the browser.`
  },
  {
    title: 'Why the Site Exists',
    body: `Daily Slant is designed for players who enjoy compact logic games with clear rules and satisfying deductions. A good Slant puzzle is quick to start, but it rewards careful counting, local reasoning, and loop awareness.

The goal is to make Slant easy to return to every day without turning it into a heavy account-based product.`
  },
  {
    title: 'Development Status',
    body: `Daily Slant is still evolving. Some features, data displays, article content, puzzle balancing, and achievement behavior may continue to change as the site is improved.

Feedback is welcome, especially if you find a puzzle issue, confusing guide content, layout problem, or mobile usability bug.`
  }
];

export const metadata: Metadata = {
  title: 'About Daily Slant',
  description: 'Learn about Daily Slant, a daily Slant puzzle site for logic practice, archive play, printable puzzles, and guides.'
};

export default async function AboutPage() {
  const messages = await getAppMessages();

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        eyebrow="About"
        hero={{
          title: 'About Daily Slant',
          subtitle: messages.site.description
        }}
      />
      <section className="static-page-content" aria-label="About Daily Slant">
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
