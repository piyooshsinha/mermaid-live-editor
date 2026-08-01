export const env = {
  /** Base URL of the hosted AI proxy; empty disables the subscription tier. */
  aiProxyUrl: import.meta.env.MERMAID_AI_PROXY_URL ?? '',
  analyticsUrl: import.meta.env.MERMAID_ANALYTICS_URL ?? '',
  docsUrl: import.meta.env.MERMAID_DOCS_URL ?? 'https://mermaid.js.org',
  domain: import.meta.env.MERMAID_DOMAIN ?? '',
  hidePrivacyPolicy: import.meta.env.MERMAID_HIDE_PRIVACY_POLICY === 'true',
  isEnabledMermaidChartLinks: import.meta.env.MERMAID_IS_ENABLED_MERMAID_CHART_LINKS === 'true',
  krokiRendererUrl: import.meta.env.MERMAID_KROKI_RENDERER_URL ?? '',
  privacyPolicyUrl: import.meta.env.MERMAID_PRIVACY_POLICY_URL ?? '',
  rendererUrl: import.meta.env.MERMAID_RENDERER_URL ?? ''
} as const;
