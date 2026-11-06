export const routes = {
  home: '/',
  process: (token: string) => `/processo/${token}`,
  processDocuments: (token: string) => `/processo/${token}/documentos`,
  resume: '/continuar',
} as const
