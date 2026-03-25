/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_STUDIO_GATEWAY_URL?: string;
  readonly PUBLIC_SHOW_STUDIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
