import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {SiteLayout} from '@/components/layout';
import {PageHeading} from '@/components/shared';
import {getGuideContent} from '@/lib/guide-content';
import {getAppMessages} from '@/lib/messages';

export async function generateMetadata({
  params
}: {
  params: Promise<{slug: string}>;
}): Promise<Metadata> {
  const {slug} = await params;
  const messages = await getAppMessages();
  const article = messages.pages.guides.articles.find((item) => item.href.endsWith(slug));
  const content = getGuideContent(slug);

  return {
    title: content?.metadata.title ?? article?.title ?? 'Guide Article',
    description: content?.metadata.description ?? article?.summary ?? messages.site.description
  };
}

export default async function GuideArticlePage({
  params
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  const messages = await getAppMessages();
  const article = messages.pages.guides.articles.find((item) => item.href.endsWith(slug));
  const content = getGuideContent(slug);

  if (!article && !content) {
    notFound();
  }

  const Content = content?.Component;
  const title = content?.metadata.title ?? article?.title ?? 'Guide Article';
  const subtitle = content?.metadata.description ?? article?.summary ?? messages.site.description;

  return (
    <SiteLayout site={messages.site}>
      <PageHeading
        hero={{
          title,
          subtitle
        }}
      />
      <article className="section-card guide-article-body">
        {Content ? (
          <Content />
        ) : (
          <>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </>
        )}
      </article>
    </SiteLayout>
  );
}
