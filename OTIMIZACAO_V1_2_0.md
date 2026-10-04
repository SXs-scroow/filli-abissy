A PROFECIA — V1.2.0 SYNC ROBUSTA

Melhorias estruturais:
- Realtime global com reconexão automática.
- Realtime de Players com reconexão automática e batching por ID.
- Estado de sincronização persistido localmente: sincronizado, sincronizando, pendente, offline e erro.
- Indicador da Central de Players passa a refletir o estado de sincronização.
- Falhas de gravação não são tratadas como sucesso.
- Salvamento crítico é forçado ao ocultar/fechar a página.
- Scroll da mesma tela é restaurado sem reintroduzir o flicker.
- Nenhuma migration nova é necessária; a atualização usa a arquitetura Supabase existente.

Validação:
- Syntax: 22/22 arquivos JS OK
- Player sync regression: 27/27 OK
- Stability audit: 17/17 OK
- Unit tests: 32/32 OK
- XSS audit: 0 novas ocorrências
- Maintenance AI: PASS
- Build local não executado: node_modules não estava disponível no pacote e a tentativa de instalação excedeu o limite.
