import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AviaryParks System',
    short_name: 'AviaryParks',
    description: 'HR & Operations Management System for Aviary Parks',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2E7D32',
    icons: [
      {
        src: '/images/myaviary-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/myaviary-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
