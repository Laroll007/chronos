import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/onboarding'],
      },
    ],
    sitemap: 'https://mychronos.fr/sitemap.xml',
    host: 'https://mychronos.fr',
  };
}
