import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css';

const gaMeasurementId = 'G-5VQB4NQNCX';

export const metadata: Metadata = {
  title: {
    default: 'Daily Slant',
    template: '%s | Daily Slant'
  },
  description: 'A daily logic puzzle site for Slant players.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      {url: '/favicon.ico'},
      {url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png'},
      {url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png'}
    ],
    apple: [{url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png'}]
  }
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}');
          `}
        </Script>
      </body>
    </html>
  );
}
