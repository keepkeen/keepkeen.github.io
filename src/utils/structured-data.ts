import { siteConfig } from '../site.config';
import {
  countWords,
  getPlainExcerpt,
  getPostLang,
  getPostPath,
  getPostSlug,
  getTagPath,
  normalizeHtmlLang,
  stripMarkdown,
  type Post,
  withBasePath
} from './content';
import { publicSocialLinks } from './site';

export type JsonLd = Record<string, unknown>;

function toAbsoluteUrl(siteOrigin: URL, path: string) {
  return new URL(path, siteOrigin).toString();
}

function getAuthorEntity(siteOrigin: URL) {
  const profileUrl = toAbsoluteUrl(siteOrigin, withBasePath('/about/'));

  return {
    '@type': 'Person',
    name: siteConfig.name,
    url: profileUrl,
    description: siteConfig.about.intro,
    ...(publicSocialLinks.length > 0 && {
      sameAs: publicSocialLinks.map((item) => item.href)
    })
  };
}

export function getDefaultSocialImage(siteOrigin: URL) {
  return toAbsoluteUrl(siteOrigin, withBasePath('/social-card.svg'));
}

export function getPostSocialImage(siteOrigin: URL, post: Post) {
  return toAbsoluteUrl(siteOrigin, withBasePath(`/og/${getPostSlug(post)}.svg`));
}

export function getSiteJsonLd(siteOrigin: URL): JsonLd[] {
  const homepage = toAbsoluteUrl(siteOrigin, withBasePath('/'));

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteConfig.name,
      url: homepage,
      description: siteConfig.description,
      inLanguage: 'en'
    },
    {
      '@context': 'https://schema.org',
      ...getAuthorEntity(siteOrigin)
    }
  ];
}

export function getBreadcrumbJsonLd(
  items: Array<{
    name: string;
    url: string;
  }>
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function getBlogCollectionJsonLd(siteOrigin: URL, posts: Post[]): JsonLd {
  const homepage = toAbsoluteUrl(siteOrigin, withBasePath('/'));
  const blogUrl = toAbsoluteUrl(siteOrigin, withBasePath('/blog/'));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${siteConfig.name} Blog`,
    url: blogUrl,
    description: 'A searchable directory of essays, notes, and technical reflections.',
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.name,
      url: homepage
    },
    mainEntity: {
      '@type': 'Blog',
      name: `${siteConfig.name} Blog`,
      url: blogUrl,
      blogPost: posts.slice(0, 12).map((post) => ({
        '@type': 'BlogPosting',
        headline: post.data.title,
        url: toAbsoluteUrl(siteOrigin, getPostPath(post)),
        datePublished: post.data.date.toISOString(),
        dateModified: (post.data.updatedDate ?? post.data.date).toISOString(),
        keywords: post.data.tags,
        inLanguage: normalizeHtmlLang(getPostLang(post))
      }))
    }
  };
}

export function getAboutPageJsonLd(siteOrigin: URL): JsonLd {
  const aboutUrl = toAbsoluteUrl(siteOrigin, withBasePath('/about/'));

  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${siteConfig.name}`,
    url: aboutUrl,
    description: siteConfig.about.intro,
    mainEntity: getAuthorEntity(siteOrigin)
  };
}

export function getBlogPostingJsonLd(siteOrigin: URL, post: Post): JsonLd {
  const blogUrl = toAbsoluteUrl(siteOrigin, withBasePath('/blog/'));
  const postUrl = toAbsoluteUrl(siteOrigin, getPostPath(post));
  const description = post.data.description || getPlainExcerpt(stripMarkdown(post.body ?? ''), 180);
  const author = getAuthorEntity(siteOrigin);
  const lang = normalizeHtmlLang(getPostLang(post));

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.data.title,
    description,
    url: postUrl,
    mainEntityOfPage: postUrl,
    image: getPostSocialImage(siteOrigin, post),
    datePublished: post.data.date.toISOString(),
    dateModified: (post.data.updatedDate ?? post.data.date).toISOString(),
    keywords: post.data.tags,
    articleSection: post.data.tags[0] ?? 'Writing',
    wordCount: countWords(post.body),
    inLanguage: lang,
    author,
    publisher: author,
    isPartOf: {
      '@type': 'Blog',
      name: `${siteConfig.name} Blog`,
      url: blogUrl
    }
  };
}

export function getTagCollectionJsonLd(siteOrigin: URL, tag: string, posts: Post[]): JsonLd {
  const tagUrl = toAbsoluteUrl(siteOrigin, getTagPath(tag));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Tag: ${tag}`,
    url: tagUrl,
    description: `Posts tagged with ${tag}.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: toAbsoluteUrl(siteOrigin, getPostPath(post)),
        name: post.data.title
      }))
    }
  };
}
