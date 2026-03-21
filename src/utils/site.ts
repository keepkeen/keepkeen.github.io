import { siteConfig } from '../site.config';

const placeholderPattern = /(example\.com|example\.github\.io|your-name)/i;

export function isPlaceholderValue(value: string) {
  return placeholderPattern.test(value);
}

export const publicSocialLinks = siteConfig.socialLinks.filter(
  (item) => !isPlaceholderValue(item.href)
);

export const publicEmail = isPlaceholderValue(siteConfig.email) ? undefined : siteConfig.email;
