# A Profecia — V1.0.1

Sistema de RPG de horror/fantasia com ficha de Player, Câmara do Mestre, banco de monstros/itens/magias, trilhas, pistas secretas, Modo Terror, TV e controle de combate.

## Centro de Controle do Mestre

A antiga tela Mesa/turnos foi retirada. O controle de combate agora fica diretamente no **Início do Mestre**.

- Players entram automaticamente no combate.
- Iniciativa pode ser definida por Player.
- Iniciar combate define a primeira vez.
- Próximo turno marca automaticamente quem acabou de agir.
- O próximo Player recebe a vez imediatamente.
- O histórico mostra quem agiu e quem recebeu a vez.
- Ao completar a ordem, começa uma nova rodada.
- Monstros cadastrados podem ser adicionados ao combate.
- O estado usa `combatSession` e é sincronizado pelo Supabase.

## Desenvolvimento

```bash
npm install
npm run check
npm run build
npm run dev
```

Node recomendado: `>=20.19.0`.
