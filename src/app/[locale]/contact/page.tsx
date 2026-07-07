import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PageHeading, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

const contactEmail = 'FrankAnqg@gmail.com';

const sections = [
  {
    title: 'Email',
    body: `For questions, feedback, bug reports, content requests, or privacy-related requests, email us at ${contactEmail}.`
  },
  {
    title: 'What to Include',
    body: `If you are reporting a puzzle or gameplay issue, please include the page URL, puzzle date or seed if visible, difficulty, device type, browser, and a short description of what happened.

If you are contacting us about privacy or data records, include enough context for us to identify the relevant session or email conversation.`
  },
  {
    title: 'Feedback We Welcome',
    body: `We are especially interested in reports about broken puzzles, confusing rules, mobile layout problems, print layout issues, achievement bugs, archive behavior, and guide topics that would help new players.

We read feedback carefully, but we may not be able to respond to every message or implement every suggestion.`
  },
  {
    title: 'Business and Content Requests',
    body: `For permission requests, content questions, or partnership ideas related to Daily Slant, use the same email address and include a clear subject line.`
  }
];

export const metadata: Metadata = {
  title: 'Contact Daily Slant',
  description: 'Contact Daily Slant for puzzle feedback, bug reports, guide suggestions, privacy requests, or content questions.'
};

export default async function ContactPage() {
  const messages = await getAppMessages();

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        hero={{
          title: 'Contact Us',
          subtitle: `Questions, bug reports, and feedback can be sent to ${contactEmail}.`
        }}
      />
      <section className="static-page-content" aria-label="Contact information">
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
