-- Drop the overly permissive policies flagged by security scanning
DROP POLICY IF EXISTS "books_all_staff" ON public.books;
DROP POLICY IF EXISTS "students_all_staff" ON public.students;
DROP POLICY IF EXISTS "issues_all_staff" ON public.issues;
DROP POLICY IF EXISTS "queue_all_staff" ON public.waiting_queue;
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
DROP POLICY IF EXISTS "settings_read_all" ON public.library_settings;

-- Restrict the core library tables to staff only (admin or librarian)
CREATE POLICY "books_staff_only" ON public.books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

CREATE POLICY "students_staff_only" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

CREATE POLICY "issues_staff_only" ON public.issues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

CREATE POLICY "queue_staff_only" ON public.waiting_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

-- Restrict profile reads to self or admin; updates/inserts remain self-only from the original migration
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Restrict library settings reads to staff only; admin update policy remains unchanged
CREATE POLICY "settings_read_staff_only" ON public.library_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
