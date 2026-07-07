import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/rules',
        destination: '/guides',
        permanent: true
      },
      {
        source: '/rules/:path*',
        destination: '/guides/:path*',
        permanent: true
      },
      {
        source: '/en/rules',
        destination: '/en/guides',
        permanent: true
      },
      {
        source: '/en/rules/:path*',
        destination: '/en/guides/:path*',
        permanent: true
      }
    ];
  }
};

export default withMDX(nextConfig);
