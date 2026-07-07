import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PageHeading, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

const contactEmail = 'FrankAnqg@gmail.com';

const sections = [
  {
    title: 'Information We Collect',
    body: `Daily Slant is designed to work without a full account system. When you play, we may use a local session identifier so the site can remember daily completion status, archive progress, practice results, and basic achievement records on the same browser.

We may collect gameplay information such as puzzle seed, puzzle date, difficulty, completion status, elapsed time, move count, and whether a puzzle was loaded or completed. If you contact us by email, we collect the email address and message content you choose to send.`
  },
  {
    title: 'How We Use Information',
    body: `We use gameplay information to operate the daily puzzle, show archive and achievement progress, measure puzzle usage, improve difficulty balancing, and prevent repeated recording of the same daily completion.

We use contact information only to read, respond to, and manage support or feedback messages. We do not sell personal information.`
  },
  {
    title: 'Cookies, Local Storage, and Similar Tools',
    body: `Daily Slant may use browser storage to keep a session identifier and remember play state. This helps the site load puzzles faster and keep your local progress consistent.

Your browser may let you clear cookies or local storage. If you do that, some local progress, completion status, or preferences may be reset.`
  },
  {
    title: 'Service Providers and Data Sharing',
    body: `We may use infrastructure providers, database services, hosting services, or analytics-like operational logs to run and protect the site. These providers process information only as needed to provide their services.

We may also disclose information if required by law, to protect the site, to investigate abuse, or to enforce our Terms of Use.`
  },
  {
    title: 'Children',
    body: `Daily Slant is a general-audience puzzle site and is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, contact us so we can review and delete it where appropriate.`
  },
  {
    title: 'Data Retention and Security',
    body: `We keep gameplay and operational records for as long as reasonably needed to operate the site, improve puzzles, maintain achievement records, and troubleshoot issues.

No online service can guarantee perfect security, but we aim to use reasonable technical and organizational measures to protect information handled by the site.`
  },
  {
    title: 'Your Choices and Contact',
    body: `You can contact us to ask questions about this policy or request help with information connected to your session. Because the site may not use a traditional account system, we may need details such as your browser session, puzzle date, or relevant email conversation to locate records.

Contact: ${contactEmail}`
  },
  {
    title: 'Changes to This Policy',
    body: `We may update this Privacy Policy as the site changes. If we make material changes, we will update the effective date or provide another reasonable notice on the site.`
  }
];

export const metadata: Metadata = {
  title: 'Privacy Policy | Daily Slant',
  description: 'Read the Daily Slant privacy policy, including how puzzle progress, session data, and contact messages are handled.'
};

export default async function PrivacyPolicyPage() {
  const messages = await getAppMessages();

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        eyebrow="Legal"
        hero={{
          title: 'Privacy Policy',
          subtitle: 'Effective date: July 7, 2026'
        }}
      />
      <section className="static-page-content" aria-label="Privacy policy details">
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
