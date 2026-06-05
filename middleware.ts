import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? 'thetesttribe'

export function middleware(request: NextRequest) {
  const auth = request.headers.get('authorization')

  if (auth) {
    const [scheme, encoded] = auth.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
      const colonIndex = decoded.indexOf(':')
      const pwd = decoded.slice(colonIndex + 1)
      if (pwd === PASSWORD) return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Moonlit Horizon"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhook/).*)'],
}
