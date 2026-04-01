const KNOWN_EXTERNAL_PLACEHOLDER_HOSTS = new Set([
  'images.unsplash.com',
  'i.pravatar.cc',
  'teslaeventos.com.br',
]);

const escapeSvgText = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toSvgDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const getInitials = (value: string, fallback = 'NT') => {
  const initials = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return initials || fallback;
};

export const APP_LOGO_SRC = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Norte Tech">
    <defs>
      <linearGradient id="logo-bg" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="28" fill="url(#logo-bg)"/>
    <circle cx="48" cy="48" r="31" fill="#ffffff" opacity="0.12"/>
    <path d="M27 61V35h8l13 15V35h8v26h-7L35 45v16h-8Z" fill="#ffffff"/>
    <path d="M60 35h14v7h-6v19h-8V42h-6v-7h6Z" fill="#f8fafc"/>
  </svg>
`);

export const DEFAULT_SERVICE_IMAGE_SRC = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="Servico">
    <defs>
      <linearGradient id="service-bg" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#dbeafe"/>
        <stop offset="100%" stop-color="#bfdbfe"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="28" fill="url(#service-bg)"/>
    <circle cx="94" cy="82" r="42" fill="#ffffff" opacity="0.38"/>
    <circle cx="546" cy="74" r="26" fill="#ffffff" opacity="0.22"/>
    <rect x="102" y="176" width="436" height="72" rx="24" fill="#0f172a" opacity="0.10"/>
    <path d="M178 210c10-40 29-60 56-60h172c28 0 47 20 56 60h20c16 0 28 12 28 28v20c0 9-7 16-16 16h-24c-8 18-22 27-42 27s-34-9-42-27H254c-8 18-22 27-42 27s-34-9-42-27h-24c-9 0-16-7-16-16v-20c0-16 12-28 28-28h20Z" fill="#0f172a"/>
    <circle cx="212" cy="274" r="26" fill="#1d4ed8"/>
    <circle cx="430" cy="274" r="26" fill="#1d4ed8"/>
    <path d="M238 166h164c17 0 29 10 37 30H201c8-20 20-30 37-30Z" fill="#ffffff" opacity="0.22"/>
    <text x="320" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1e3a8a">Lavagem</text>
  </svg>
`);

export const DEFAULT_PRODUCT_IMAGE_SRC = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Produto">
    <defs>
      <linearGradient id="product-bg" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#ecfeff"/>
        <stop offset="100%" stop-color="#dbeafe"/>
      </linearGradient>
    </defs>
    <rect width="320" height="320" rx="36" fill="url(#product-bg)"/>
    <rect x="104" y="58" width="112" height="204" rx="26" fill="#0f172a" opacity="0.90"/>
    <rect x="124" y="36" width="72" height="34" rx="12" fill="#1d4ed8"/>
    <rect x="122" y="112" width="76" height="56" rx="16" fill="#f8fafc"/>
    <rect x="122" y="180" width="76" height="16" rx="8" fill="#60a5fa"/>
    <rect x="122" y="208" width="56" height="14" rx="7" fill="#bfdbfe"/>
  </svg>
`);

export const DEFAULT_AVATAR_IMAGE_SRC = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Equipe">
    <defs>
      <linearGradient id="avatar-bg" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#e0f2fe"/>
        <stop offset="100%" stop-color="#dbeafe"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="40" fill="url(#avatar-bg)"/>
    <circle cx="80" cy="62" r="28" fill="#1d4ed8" opacity="0.92"/>
    <path d="M34 136c8-28 28-42 46-42s38 14 46 42H34Z" fill="#0f172a" opacity="0.88"/>
  </svg>
`);

export function isKnownExternalPlaceholderUrl(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('/uploads/')) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return KNOWN_EXTERNAL_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getSafeLogoSrc() {
  return APP_LOGO_SRC;
}

export function getSafeServiceImage(value?: string | null, label = 'Lavagem') {
  if (value && !isKnownExternalPlaceholderUrl(value)) {
    return value;
  }

  return DEFAULT_SERVICE_IMAGE_SRC;
}

export function getSafeProductImage(value?: string | null, label = 'Produto') {
  if (value && !isKnownExternalPlaceholderUrl(value)) {
    return value;
  }

  const initials = getInitials(label, 'PR');
  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${escapeSvgText(label)}">
      <defs>
        <linearGradient id="product-card" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#eff6ff"/>
          <stop offset="100%" stop-color="#dbeafe"/>
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="36" fill="url(#product-card)"/>
      <rect x="76" y="68" width="168" height="184" rx="32" fill="#0f172a" opacity="0.10"/>
      <circle cx="160" cy="126" r="42" fill="#2563eb"/>
      <text x="160" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${escapeSvgText(initials)}</text>
      <rect x="96" y="196" width="128" height="18" rx="9" fill="#1d4ed8" opacity="0.75"/>
      <rect x="112" y="226" width="96" height="14" rx="7" fill="#0f172a" opacity="0.22"/>
    </svg>
  `);
}

export function getSafeAvatarImage(value?: string | null, label = 'Equipe') {
  if (value && !isKnownExternalPlaceholderUrl(value)) {
    return value;
  }

  const initials = getInitials(label, 'NT');
  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${escapeSvgText(label)}">
      <defs>
        <linearGradient id="avatar-card" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#dbeafe"/>
          <stop offset="100%" stop-color="#bfdbfe"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="40" fill="url(#avatar-card)"/>
      <circle cx="80" cy="56" r="28" fill="#1d4ed8"/>
      <path d="M32 134c10-26 28-40 48-40s38 14 48 40H32Z" fill="#0f172a" opacity="0.88"/>
      <circle cx="118" cy="118" r="26" fill="#ffffff" opacity="0.86"/>
      <text x="118" y="126" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1d4ed8">${escapeSvgText(initials)}</text>
    </svg>
  `);
}
