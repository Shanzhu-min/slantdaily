import Link from 'next/link';
import type {Metadata} from 'next';
import {BookOpen, ChevronLeft, ChevronRight} from 'lucide-react';
import {SiteLayout} from '@/components/layout';
import {Faq, PageHeading, Sections} from '@/components/shared';
import {guideContents} from '@/lib/guide-content';
import {getAppMessages} from '@/lib/messages';

const articlesPerPage = 6;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getAppMessages();
  const page = messages.pages.guides;

  return {
    title: page.metadata.title,
    description: page.metadata.description
  };
}

export default async function GuidesPage({
  searchParams
}: {
  searchParams: Promise<{page?: string}>;
}) {
  const {page: pageParam} = await searchParams;
  const messages = await getAppMessages();
  const page = messages.pages.guides;
  const totalPages = Math.max(1, Math.ceil(guideContents.length / articlesPerPage));
  const requestedPage = Number(pageParam ?? '1');
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(Math.floor(requestedPage), totalPages)
      : 1;
  const startIndex = (currentPage - 1) * articlesPerPage;
  const articles = guideContents.slice(startIndex, startIndex + articlesPerPage).map((article) => ({
    title: article.metadata.title,
    summary: article.metadata.description,
    tag: article.metadata.category,
    href: `/guides/${article.slug}`
  }));

  return (
    <SiteLayout site={messages.site}>
      <PageHeading hero={page.hero} />
      <section className="article-grid" aria-label="Guide articles">
        {articles.map((article) => (
          <article className="article-card" key={article.title}>
            <h3>{article.title}</h3>
            {article.tag ? <span className="article-tag">{article.tag}</span> : null}
            <p className="article-summary">{article.summary}</p>
            <Link className="button btn-secondary" href={article.href}>
              <BookOpen size={16} aria-hidden="true" />
              Continue reading
            </Link>
          </article>
        ))}
      </section>
      {totalPages > 1 ? (
        <nav className="pagination" aria-label="Guide pages">
          <Link
            className={`pagination-link icon-only ${currentPage === 1 ? 'disabled' : ''}`}
            href={currentPage === 2 ? '/guides' : `/guides?page=${currentPage - 1}`}
            aria-label="Previous page"
            aria-disabled={currentPage === 1}
            tabIndex={currentPage === 1 ? -1 : undefined}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          {Array.from({length: totalPages}, (_, index) => {
            const pageNumber = index + 1;
            return (
              <Link
                className={`pagination-link ${pageNumber === currentPage ? 'active' : ''}`}
                href={pageNumber === 1 ? '/guides' : `/guides?page=${pageNumber}`}
                key={pageNumber}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </Link>
            );
          })}
          <Link
            className={`pagination-link icon-only ${currentPage === totalPages ? 'disabled' : ''}`}
            href={`/guides?page=${currentPage + 1}`}
            aria-label="Next page"
            aria-disabled={currentPage === totalPages}
            tabIndex={currentPage === totalPages ? -1 : undefined}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </nav>
      ) : null}
      <Sections sections={page.sections} />
      {page.faq ? <Faq faq={page.faq} /> : null}
    </SiteLayout>
  );
}
