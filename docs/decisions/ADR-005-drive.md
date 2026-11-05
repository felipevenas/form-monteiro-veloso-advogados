# ADR-005 — Google Drive Compartilhado + service account

**Status:** aceito; depende de confirmação do escritório.

## Contexto

O PRD exige arquivos privados, organizados por cliente, sem expor o Drive ao navegador. Service accounts do Google não têm cota no “Meu Drive”.

## Decisão

- Usar **Drive Compartilhado** (Google Workspace) e adicionar a service account como membro com permissão de conteúdo.
- Guardar IDs de pasta no banco (`integration_configurations` ou `drive_folders`).
- Upload via REST + JWT (`jose`), não SDK pesado.
- `appProperties` nos arquivos com `process_id` e `document_id`.
- Manter o Storage privado como staging e apagar após a confirmação.

## Consequências

- Sem cota pessoal e sem credencial no browser.
- A cliente precisa confirmar que existe um Drive Compartilhado e quem administra.
- Se não houver Workspace, a alternativa é OAuth de um usuário com refresh token — mais frágil e exige processo de reconexão.
