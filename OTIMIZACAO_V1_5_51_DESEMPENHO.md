# Ashen Testimony V1.5.51 — diagnóstico de desempenho local

## Objetivo
Abrir a próxima etapa de desempenho com métricas observáveis antes de alterar renderização, persistência ou sincronização de forma arriscada. Mantém a versão V1.5.50 como base e preserva a Central de Testes do Mestre.

## O que entrou
- Novo módulo isolado `src/performance/performanceDiagnostics.js`.
- Monitoramento de Long Tasks (>50 ms) desde o início da aplicação, quando o navegador suporta `PerformanceObserver`.
- Medição sob demanda de tempos de navegação, recursos carregados e maiores recursos, contagem de elementos DOM, heap JS quando exposto, informações gerais de hardware/rede e uma pequena amostra de atraso do event loop.
- Nova seção **5. Desempenho local, memória e carregamento** na Central de Testes.
- A coleta é somente leitura: não limpa cache, não salva ficha, não executa sincronização e não escreve no servidor.
- Métricas indisponíveis são identificadas como limitação da API do navegador, e não como falha do site.

## Por que não fizemos mudanças agressivas
O profiling real precisa revelar se o gargalo está em JavaScript, layout/paint, imagens, rede ou memória. Alterar o renderizador legado ou a sincronização antes de ter essa evidência aumenta o risco de regressões. Esta versão instala a medição necessária e conserva os fluxos existentes.

## Como testar
1. Abra o site e faça login como Mestre.
2. Acesse **Mais ferramentas → Teste de carga**.
3. Clique **Medir desempenho local** logo após abrir o site.
4. Navegue por Home, Ficha, Mesa e telas usadas durante a sessão; volte ao laboratório e meça novamente.
5. Compare em dispositivo móvel e computador. Uma medição isolada não representa todos os dispositivos, cache ou conexões.
6. Continue executando os testes de persistência, sincronização, versão/cache e clientes virtuais já existentes.

## Interpretação e limites
- O tempo `load` não mede sozinho a experiência completa de uma aplicação de navegação interna.
- `transferSize` pode vir zerado/indisponível por causa de cache ou políticas de privacidade.
- O heap JavaScript normalmente é exposto apenas em alguns navegadores baseados em Chromium.
- Long Tasks só são capturadas se a API estiver disponível e o monitor começou desde a abertura desta página.
- A amostra de atraso local tem cinco tentativas e é apenas um sinal aproximado, não um benchmark científico.
- Nenhuma métrica local prova a capacidade de 30 pessoas simultâneas no servidor.
