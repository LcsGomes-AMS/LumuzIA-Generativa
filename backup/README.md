# Política e Registro de Backups — LumuzIA

Este diretório armazena os backups periódicos da aplicação.

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
| Versão | Data | Tipo | Status |
|---|---|---|---|
| *(Nenhum backup gerado ainda - próximo na 5ª modificação)* | - | - | - |
