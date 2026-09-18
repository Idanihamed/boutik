/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le navigateur ne parle jamais directement à l'API : il appelle /api/... sur le domaine du
  // site, et Next relaie vers l'API réelle (BACKEND_ORIGIN, jamais exposé au navigateur). Les
  // cookies de session deviennent ainsi « premier parti » et ne sont pas bloqués par les
  // navigateurs qui rejettent les cookies tiers (Safari en tête) quand site et API sont sur
  // deux domaines différents.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3101';
    return [
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backendOrigin}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
