import { NextResponse } from 'next/server';
import { getSession } from './lib/session';

export async function middleware(request) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  // Halaman yang membutuhkan login (role USER)
  const protectedUserRoutes = ['/dashboard'];
  
  // Halaman yang membutuhkan login (role ADMIN)
  const protectedAdminRoutes = ['/admin', '/admin/dashboard'];

  // Jika belum login dan mencoba akses halaman terproteksi
  if (!session && (protectedUserRoutes.some(path => pathname.startsWith(path)) || protectedAdminRoutes.some(path => pathname.startsWith(path)))) {
    // Untuk halaman admin, arahkan ke login admin. Jika tidak, ke login biasa.
    // (Saat ini kita belum punya login terpisah, jadi semua ke /login)
    const url = request.nextUrl.clone();
    url.pathname = '/login'; // Asumsi halaman login ada di /login
    return NextResponse.redirect(url);
  }

  // Jika sudah login
  if (session) {
    // Jika role USER mencoba akses halaman admin
    if (session.role === 'USER' && protectedAdminRoutes.some(path => pathname.startsWith(path))) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard'; // Arahkan ke dashboard user
      return NextResponse.redirect(url);
    }
    
    // Jika role ADMIN mencoba akses halaman user
    if (session.role === 'ADMIN' && protectedUserRoutes.some(path => pathname.startsWith(path))) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/dashboard'; // Arahkan ke dashboard admin
        return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

