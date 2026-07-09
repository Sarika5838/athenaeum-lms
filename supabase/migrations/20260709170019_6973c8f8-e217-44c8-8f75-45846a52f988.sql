
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'librarian');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + role on signup (first user = admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  assigned_role := CASE WHEN user_count = 0 THEN 'admin'::public.app_role ELSE 'librarian'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Timestamps helper
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Books
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'General',
  publisher TEXT,
  published_year INTEGER,
  cover_url TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX books_title_idx ON public.books USING gin (to_tsvector('simple', title || ' ' || author || ' ' || coalesce(isbn,'')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_all_staff" ON public.books FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER books_touch BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_all_staff" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER students_touch BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Issues
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','returned')),
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX issues_status_idx ON public.issues(status);
CREATE INDEX issues_student_idx ON public.issues(student_id);
CREATE INDEX issues_book_idx ON public.issues(book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues_all_staff" ON public.issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER issues_touch BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Waiting queue
CREATE TABLE public.waiting_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (book_id, student_id, fulfilled)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_queue TO authenticated;
GRANT ALL ON public.waiting_queue TO service_role;
ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_all_staff" ON public.waiting_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings (singleton row)
CREATE TABLE public.library_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library_name TEXT NOT NULL DEFAULT 'Central Library',
  fine_per_day NUMERIC(10,2) NOT NULL DEFAULT 2.00,
  loan_period_days INTEGER NOT NULL DEFAULT 14,
  max_books_per_student INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.library_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.library_settings TO authenticated;
GRANT ALL ON public.library_settings TO service_role;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.library_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_update" ON public.library_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Issue book: decrement copies atomically
CREATE OR REPLACE FUNCTION public.issue_book(_book_id UUID, _student_id UUID, _due_date TIMESTAMPTZ)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  avail INTEGER;
BEGIN
  SELECT available_copies INTO avail FROM public.books WHERE id = _book_id FOR UPDATE;
  IF avail IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF avail <= 0 THEN RAISE EXCEPTION 'No copies available'; END IF;

  UPDATE public.books SET available_copies = available_copies - 1 WHERE id = _book_id;
  INSERT INTO public.issues (book_id, student_id, due_date, issued_by)
  VALUES (_book_id, _student_id, _due_date, auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.issue_book(UUID, UUID, TIMESTAMPTZ) TO authenticated;

-- Return book: compute fine, increment copies
CREATE OR REPLACE FUNCTION public.return_book(_issue_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r_book UUID;
  r_due TIMESTAMPTZ;
  r_status TEXT;
  days_late INTEGER;
  rate NUMERIC;
  fine NUMERIC := 0;
BEGIN
  SELECT book_id, due_date, status INTO r_book, r_due, r_status
  FROM public.issues WHERE id = _issue_id FOR UPDATE;
  IF r_book IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF r_status = 'returned' THEN RAISE EXCEPTION 'Already returned'; END IF;

  SELECT fine_per_day INTO rate FROM public.library_settings WHERE id = 1;
  days_late := GREATEST(0, EXTRACT(DAY FROM (now() - r_due))::INTEGER);
  fine := days_late * COALESCE(rate, 0);

  UPDATE public.issues SET status='returned', return_date=now(), fine_amount=fine WHERE id = _issue_id;
  UPDATE public.books SET available_copies = available_copies + 1 WHERE id = r_book;
  RETURN fine;
END;
$$;
GRANT EXECUTE ON FUNCTION public.return_book(UUID) TO authenticated;
