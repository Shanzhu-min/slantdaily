import type {Metadata} from 'next';
import {ArchiveCalendar} from '@/components/archive-calendar';
import {SiteLayout} from '@/components/layout';
import {PageHeading, Sections} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';
import {getArchiveMonth} from '@/lib/supabase-puzzles';

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
  const initialArchive = await getArchiveMonth({
    sessionId: null,
    year: null,
    month: null
  }).catch(() => null);

  return (
    <SiteLayout site={messages.site}>
      <PageHeading hero={page.hero} />
      <ArchiveCalendar initialArchive={initialArchive} />
      <Sections sections={page.sections} />
    </SiteLayout>
  );
}
