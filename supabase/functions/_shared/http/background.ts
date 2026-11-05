/**
 * Trabalho que deve sobreviver ao fim da resposta HTTP.
 *
 * O Edge Runtime mantém a promise viva com `waitUntil`; em runtime sem esse
 * recurso (testes, Deno puro) a promise segue em segundo plano.
 */

interface EdgeRuntimeLike {
  waitUntil?: (promise: Promise<unknown>) => void
}

export function runInBackground(task: Promise<unknown>): void {
  const guarded = task.catch((cause) => {
    console.error('[background] tarefa falhou:', cause)
  })

  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime

  if (runtime?.waitUntil) {
    runtime.waitUntil(guarded)
    return
  }

  void guarded
}
