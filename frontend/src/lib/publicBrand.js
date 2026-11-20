/** Public marketing brand assets (parity with cert-studio / govern). */

export const CDAC_LOGO_SRC = `${import.meta.env.BASE_URL}logos/cdac-brand.svg`;
export const CDAC_LOGO_ON_DARK_SRC = `${import.meta.env.BASE_URL}logos/cdac-brand-on-dark.svg`;
export const CDAC_HOME_URL = 'https://www.cdac.in/';

/** Institutional copyright line (C-DAC is the rights holder; Q-TeleScope is the product name). */
export function cdacCopyrightLine(year) {
  return `© ${year} Centre for Development of Advanced Computing (C-DAC). All rights reserved.`;
}