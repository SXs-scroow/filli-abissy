-- The browser uses the legacy anonymous Supabase role plus its application token.
-- The targeted Player RPC performs its own token authorization, so the
-- authenticated role does not need EXECUTE access and should not have it.
revoke execute on function public.a_profecia_get_players_by_ids(text, text[]) from authenticated;
grant execute on function public.a_profecia_get_players_by_ids(text, text[]) to anon;
