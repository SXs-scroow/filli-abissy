# V65.6 stability checks

Static checks performed before release:
- JavaScript syntax check (`node --check app.js`)
- Vite production build
- ZIP integrity

Runtime invariants to verify against the configured Supabase project:
1. F5 preserves role/session and current player.
2. A temporary player-table read failure never logs a player out.
3. Missing player row is not treated as deletion; only a confirmed newer tombstone is.
4. Player writes are isolated by player id and `_syncUpdatedAt`.
5. Global realtime updates preserve locally dirty domains instead of overwriting them.
6. Roll entries have unique ids and UI history is rebuilt from canonical player state, preventing duplicate realtime insertion.
7. Uploaded media uses Supabase Storage URLs and a local recovery index as a secondary cache.
8. Remote image fields missing from an update cannot erase a locally known image URL.
9. Backgrounds use remote Storage URLs on reload; local IndexedDB is a fallback.
10. Realtime player updates do not rebuild the active sheet DOM.
