# Ashen Testimony V1.5.41 — feedback de sincronização do mapa

## Correções
- A edição de regiões agora diferencia sucesso sincronizado de salvamento apenas local quando a sincronização falha.
- A remoção de assets agora informa explicitamente falhas de sincronização, em vez de ignorar silenciosamente a rejeição.
- Os dados continuam preservados localmente; nenhuma migração de banco ou exclusão de dados foi feita.

## Verificação
- Sintaxe JavaScript: aprovada.
- Testes específicos do mapa: aprovados.
- A suíte completa de regressão da versão-base foi aprovada anteriormente (101 testes unitários, 32 verificações de sincronização, 19 verificações de estabilidade, 10 testes de caos e auditoria XSS sem novas ocorrências).
- A compilação de produção ainda precisa ser executada em ambiente com dependências instaláveis; `npm install` excedeu o limite de tempo deste ambiente. Não considerar esta versão validada em navegador até testar a compilação e os fluxos reais.
