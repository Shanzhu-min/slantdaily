import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {MockGameFrame} from '@/components/mock-game-frame';
import {Faq, Sections, TextBlock} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getAppMessages();
  const page = messages.pages.home;

  return {
    title: page.metadata.title,
    description: page.metadata.description,
    openGraph: {
      title: page.metadata.title,
      description: page.metadata.description,
      images: ['/images/daily-challenge.png']
    }
  };
}

export default async function HomePage() {
  const messages = await getAppMessages();
  const page = messages.pages.home;

  return (
    <SiteLayout site={messages.site}>
      <div id="daily-game">
        <MockGameFrame />
      </div>
      <section className="daily-intro" aria-labelledby="daily-title">
        <h1 id="daily-title">{page.hero.title}</h1>
        <div className="section-card">
          <TextBlock text={page.hero.subtitle} />
        </div>
      </section>
      <Sections sections={page.sections} />
      <Faq faq={page.faq} />
    </SiteLayout>
  );
}
