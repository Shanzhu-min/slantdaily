import {NextResponse, type NextRequest} from 'next/server';

const defaultLocale = 'en';

export function middleware(request: NextRequest) {
  const {pathname, search} = request.nextUrl;

  if (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
  url.search = search;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
