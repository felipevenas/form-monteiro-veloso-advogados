export const routes = {
  home: '/',
  process: (token: string) => `/processo/${token}`,
  processDocuments: (token: string) => `/processo/${token}/documentos`,
  resume: '/continuar',
  admin: {
    login: '/admin/entrar',
    dashboard: '/admin',
    processes: '/admin/processos',
    process: (id: string) => `/admin/processos/${id}`,
  },
} as const
