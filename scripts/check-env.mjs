const isVercelProduction = process.env.VERCEL_ENV === 'production'

if (!isVercelProduction) {
  process.exit(0)
}

const problems = []

if (process.env.VITE_API_MODE !== 'http') {
  problems.push('VITE_API_MODE precisa ser "http" em produção (o modo mock não pode ir ao ar).')
}

if (!process.env.VITE_SUPABASE_URL) {
  problems.push('VITE_SUPABASE_URL não configurada.')
}

if (!process.env.VITE_SUPABASE_ANON_KEY) {
  problems.push('VITE_SUPABASE_ANON_KEY não configurada.')
}

if (problems.length > 0) {
  console.error('\nBuild de produção bloqueado:\n')
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  console.error('')
  process.exit(1)
}
