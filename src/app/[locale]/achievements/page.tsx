import type {Metadata} from 'next';
import {AchievementDashboard} from '@/components/achievement-dashboard';
import {SiteLayout} from '@/components/layout';
import {PageHeading} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getAppMessages();
  const page = messages.pages.achievements;

  return {
    title: page.metadata.title,
    description: page.metadata.description
  };
}

export default async function AchievementsPage() {
  const messages = await getAppMessages();
  const page = messages.pages.achievements;

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        hero={{
          title: page.hero.title,
          subtitle: page.hero.subtitle
        }}
      />
      <AchievementDashboard items={page.items} />
    </SiteLayout>
  );
}
