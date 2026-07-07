import Image from 'next/image';
import Link from 'next/link';
import {ArrowRight, Play, Printer} from 'lucide-react';
import type {FaqContent, HeroContent, SectionContent} from '@/lib/types';

type HeroProps = {
  eyebrow?: string;
  hero: HeroContent;
  image?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

function splitParagraphs(text: string) {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function TextBlock({text, className}: {text: string; className?: string}) {
  return (
    <div className={['text-block', className ?? ''].filter(Boolean).join(' ')}>
      {splitParagraphs(text).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export function Hero({
  eyebrow,
  hero,
  image,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: HeroProps) {
  return (
    <section className={`hero ${image ? '' : 'hero-text-only'}`}>
      <div className="hero-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{hero.title}</h1>
        <TextBlock className="hero-subtitle" text={hero.subtitle} />
        {primaryHref || secondaryHref ? (
          <div className="hero-actions">
            {primaryHref && primaryLabel ? (
              <Link className="button btn-primary" href={primaryHref}>
                <Play size={18} aria-hidden="true" />
                {primaryLabel}
              </Link>
            ) : null}
            {secondaryHref && secondaryLabel ? (
              <Link className="button btn-secondary" href={secondaryHref}>
                <Printer size={18} aria-hidden="true" />
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {image ? (
        <div className="surface media-panel">
          <Image src={image} alt="" width={900} height={675} priority />
        </div>
      ) : null}
    </section>
  );
}

export function PageHeading({eyebrow, hero}: {eyebrow?: string; hero: HeroContent}) {
  return (
    <section className="page-heading">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{hero.title}</h1>
      <p>{hero.subtitle}</p>
    </section>
  );
}

export function Sections({sections}: {sections: SectionContent[]}) {
  return (
    <section className="section-grid" aria-label="Page sections">
      {sections.map((section) => (
        <article className="section-item" key={section.title}>
          <h2>{section.title}</h2>
          <div className="section-card">
            <TextBlock text={section.body} />
          </div>
        </article>
      ))}
    </section>
  );
}

export function Faq({faq}: {faq: FaqContent}) {
  return (
    <section className="faq-section" aria-label={faq.title}>
      <div className="faq-heading">
        <h2>{faq.title}</h2>
        <p>{faq.description}</p>
      </div>
      <div className="faq-list">
        {faq.items.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function TextLink({href, children}: {href: string; children: React.ReactNode}) {
  return (
    <Link className="button btn-secondary" href={href}>
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
