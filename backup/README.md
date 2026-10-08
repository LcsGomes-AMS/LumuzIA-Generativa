# Política e Registro de Backups — LumuzIA

Este diretório contém backups **locais e privados**. Os ZIPs foram retirados do rastreamento do Git e permanecem no computador.

Os backups v0.88 e v0.93 contêm arquivos de credenciais e bancos de dados. Não os publique nem envie para o repositório. As credenciais já presentes no histórico precisam ser revogadas conforme [SECURITY.md](../SECURITY.md). Nenhuma limpeza ou exclusão dos arquivos locais foi executada.

Para cópias de código compartilháveis, exclua `.env*`, chaves administrativas, arquivos de banco, logs e metadados `.git`. Cópias de dados e configurações devem ficar em armazenamento privado com controle de acesso e proteção adequada.

## Regras de Backup
1. **Frequência:** Um backup completo é gerado a cada 5 modificações/versões.
2. **Identificação:** Cada arquivo/pasta de backup é nomeado com a respectiva versão (ex.: `backup-v0.88.zip`).
3. **Retenção (Rotação de Versões):**
   - São mantidas no máximo 5 versões regulares ativas.
   - Ao atingir **6 versões**, a versão mais antiga é excluída automaticamente.
4. **Exceção (Destaque):**
   - Caso uma versão seja indicada pelo usuário para não ser apagada, ela recebe o marcador `[DESTAQUE]` (ex.: `backup-v0.88-DESTAQUE.zip`).
   - Versões em destaque ficam permanentemente preservadas e não entram no limite da limpeza automática.

## Histórico de Backups
| Versão | Data | Tipo | Arquivo | Status |
|---|---|---|---|---|
| `v0.88` | 05/10/2026 | Completo (Código + Configs) | `backup-v0.88.zip` | Ativo (1 de 5) |
| `v0.93` | 05/10/2026 | Completo (Código + Configs) | `backup-v0.93.zip` | Ativo (2 de 5) |
