;(() => {
  try {
    const key = 'mv:theme'
    const choiceKey = 'mv:theme:chosen'

    // Versões anteriores gravavam a preferência do sistema no primeiro acesso,
    // sem o visitante escolher. Só respeitamos a preferência se houve escolha.
    if (!localStorage.getItem(choiceKey)) {
      localStorage.removeItem(key)
    }

    // Padrão do produto: abrir no claro. O botão do cabeçalho alterna e a
    // escolha fica salva em `mv:theme`.
    const stored = localStorage.getItem(key)
    document.documentElement.dataset.theme = stored === 'dark' ? 'dark' : 'light'
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
