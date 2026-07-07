import type {Metadata} from 'next';
import {SiteLayout} from '@/components/layout';
import {PrintableSlantBuilder} from '@/components/printable-slant-builder';
import {Sections} from '@/components/shared';
import {getAppMessages} from '@/lib/messages';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getAppMessages();
  const page = messages.pages.printable;

  return {
    title: page.metadata.title,
    description: page.metadata.description
  };
}

export default async function PrintableSlantPage() {
  const messages = await getAppMessages();
  const page = messages.pages.printable;

  return (
    <SiteLayout site={messages.site}>
      <PrintableSlantBuilder
        title={page.hero.title}
        subtitle={page.hero.subtitle}
        previewTitle={page.print.previewTitle}
      />
      <Sections sections={page.sections} />
    </SiteLayout>
  );
}
