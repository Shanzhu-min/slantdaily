import Image from 'next/image';
import Link from 'next/link';
import type {AppMessages} from '@/lib/types';

type SiteLayoutProps = {
  site: AppMessages['site'];
  children: React.ReactNode;
};

export function SiteLayout({site, children}: SiteLayoutProps) {
  const footerColumns = [
    [
      {label: 'Daily Slant', href: '/'},
      {label: 'Archive', href: '/archive'},
      {label: 'Achievements', href: '/achievements'},
      {label: 'Printable Slant', href: '/printable-slant'}
    ],
    [
      {
        label: 'How to Play Slant',
        href: '/guides/how-to-play-slant-beginner-puzzle-guide'
      },
      {
        label: 'Slant Rules Explained',
        href: '/guides/slant-rules-explained-lines-numbers-no-loops'
      },
      {label: 'Guides', href: '/guides'}
    ],
    [
      {label: 'Privacy Policy', href: '/privacy-policy'},
      {label: 'Terms of Use', href: '/terms-of-service'},
      {label: 'About', href: '/about'},
      {label: 'Contact Us', href: '/contact'}
    ]
  ];

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label={site.name}>
            <span className="brand-mark">
              <Image
                src="/android-chrome-192x192.png"
                alt=""
                width={28}
                height={28}
                priority
                aria-hidden="true"
              />
            </span>
            <span>{site.name}</span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            {site.nav.map((item) => (
              <Link className="nav-link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          {footerColumns.map((column, index) => (
            <nav className="footer-column" aria-label={`Footer column ${index + 1}`} key={index}>
              {column.map((item) => (
                <Link href={item.href} key={`${item.href}-${item.label}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </footer>
    </div>
  );
}
