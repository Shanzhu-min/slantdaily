export type MetadataContent = {
  title: string;
  description: string;
  keywords?: string;
};

export type HeroContent = {
  title: string;
  subtitle: string;
};

export type SectionContent = {
  title: string;
  body: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqContent = {
  title: string;
  description: string;
  items: FaqItem[];
};

export type AchievementItem = {
  id: string;
  title: string;
  image: string;
  description: string;
  count?: number;
};

export type AppMessages = {
  site: {
    name: string;
    description: string;
    url: string;
    nav: Array<{label: string; href: string}>;
  };
  pages: {
    home: {
      metadata: MetadataContent;
      hero: HeroContent;
      sections: SectionContent[];
      faq: FaqContent;
    };
    archive: {
      metadata: MetadataContent;
      hero: HeroContent;
      sections: SectionContent[];
      faq?: FaqContent;
    };
    achievements: {
      metadata: MetadataContent;
      hero: HeroContent;
      sections?: SectionContent[];
      items: AchievementItem[];
    };
    printable: {
      metadata: MetadataContent;
      hero: HeroContent;
      print: {
        previewTitle: string;
        footerLine: string;
        domain: string;
        tips: string[];
      };
      sections: SectionContent[];
    };
    guides: {
      metadata: MetadataContent;
      hero: HeroContent;
      articles: Array<{
        title: string;
        summary: string;
        tag?: string;
        image: string;
        href: string;
      }>;
      sections: SectionContent[];
      faq?: FaqContent;
    };
  };
};
