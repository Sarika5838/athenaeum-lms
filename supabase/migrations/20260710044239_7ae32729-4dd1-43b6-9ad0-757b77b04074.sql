-- Fix mutable search_path on the updated-at trigger function
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- SECURITY DEFINER functions should not be callable by anonymous users.
-- Revoke default public EXECUTE and grant only to the roles that need them.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.issue_book(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.return_book(UUID) FROM PUBLIC;

-- Grant back to authenticated for the functions the app calls directly
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_book(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_book(UUID) TO authenticated;

-- handle_new_user is invoked by the auth trigger, not app users; keep it for service_role only
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Ensure service_role can still use all internal functions
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_book(UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.return_book(UUID) TO service_role;
