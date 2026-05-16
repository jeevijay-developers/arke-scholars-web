// Shared brand styling for Arke Scholars transactional emails.
// Brand: Primary #F97316 (orange), Navy #1E293B, bg #FFFBF5, font: Plus Jakarta Sans
// Email body bg MUST be white (#ffffff) per email rules.

export const SITE_NAME = 'Arke Scholars'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}

export const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

export const brand = {
  fontSize: '22px',
  fontWeight: '800',
  color: '#F97316',
  letterSpacing: '-0.5px',
  margin: '0',
}

export const card = {
  backgroundColor: '#FFFBF5',
  borderRadius: '16px',
  padding: '32px 28px',
  border: '1px solid #FFE5CC',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: '800',
  color: '#1E293B',
  margin: '0 0 12px',
  lineHeight: '1.3',
}

export const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

export const muted = {
  fontSize: '13px',
  color: '#94A3B8',
  lineHeight: '1.5',
  margin: '0',
}

export const button = {
  backgroundColor: '#F97316',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700',
  padding: '12px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0',
}

export const footer = {
  fontSize: '12px',
  color: '#94A3B8',
  textAlign: 'center' as const,
  margin: '24px 0 0',
  lineHeight: '1.5',
}

export const divider = {
  borderTop: '1px solid #E2E8F0',
  margin: '24px 0',
}

export const stat = {
  fontSize: '13px',
  color: '#1E293B',
  fontWeight: '600',
  margin: '4px 0',
}

export const label = {
  fontSize: '11px',
  color: '#94A3B8',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
}
