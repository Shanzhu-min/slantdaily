import type {Metadata} from 'next';
import {ArchiveCalendar} from '@/components/archive-calendar';
import {SiteLayout} from '@/components/layout';
import {PageHeading, Sections} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getAppMessages();
  const page = messages.pages.archive;

  return {
    title: page.metadata.title,
    description: page.metadata.description
  };
}

export default async function ArchivePage() {
  const messages = await getAppMessages();
  const page = messages.pages.archive;

  return (
    <SiteLayout site={messages.site}>
      <PageHeading hero={page.hero} />
      <ArchiveCalendar />
      <Sections sections={page.sections} />
    </SiteLayout>
  );
}
