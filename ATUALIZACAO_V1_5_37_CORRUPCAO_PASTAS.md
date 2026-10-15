# Ashen Testimony V1.5.37 — Corrupção de pastas

- O editor de terminais agora aceita marcar pastas inteiras como corrompidas, além dos arquivos individuais.
- Formato JSON de exemplo:

```json
{
  "documents": {"content": "Texto da pasta Documentos", "corrupted": true},
  "records": {"content": "Logs recuperados", "corrupted": false},
  "evidence": "Texto simples para uma pasta normal",
  "system": {"title": "NÚCLEO DANIFICADO", "content": "Dados ilegíveis", "corrupted": true}
}
```

- Pastas corrompidas exibem alerta, estado visual vermelho, erro de integridade e ruído sintetizado ao abrir.
- Compatibilidade mantida com o formato antigo, em que cada pasta era apenas uma string.
- Nenhuma migração de banco adicional é necessária: a configuração permanece embutida no conteúdo do terminal e persiste pelo RPC existente.
