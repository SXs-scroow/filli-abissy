# Ashen Testimony V1.5.27 — Vida e estabilização

## Fórmula de Vida (campanha)
- Corpo 0: 18/18
- Corpo 1: 24/24
- Corpo 2: 27/27
- Corpo 3+: 27 + 9 por ponto acima de 2, limitado a 65 (3=36, 4=45, 5=54, 6=63, 7+=65).
- A Vida atual é limitada ao novo máximo sem curar automaticamente personagens feridos.
- Sanidade mantém a regra anterior. Personagens slasher mantêm a regra própria.

## Estabilização incluída
- Versão da aplicação atualizada para V1.5.27.
- Limites de Vida da campanha e dos campos de edição alinhados ao máximo de 65.
- Mantidas as proteções de sincronização, sessões, permissões e armazenamento de puzzles/notas.

## Validação local executada
- Sintaxe: 40 arquivos JavaScript aprovados.
- Unitários: 92/92 aprovados.
- Auditoria de sincronização: 32/32 aprovados.
- Estabilidade: 19/19 aprovados.
- Teste de caos: 10/10 aprovados. O aviso `terminated` aparece no cenário de falha de rede simulada e o teste passa.
- Manutenção: aprovado.
- Auditoria XSS: 21 ocorrências conhecidas, 0 novas.

O build do Vite e a integração com o Supabase remoto não foram validados neste ambiente. A migração de puzzles/notas precisa estar aplicada no projeto Supabase do usuário.
