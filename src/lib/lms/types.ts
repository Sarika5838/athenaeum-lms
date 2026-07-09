// Domain types (mirrors the DB schema)
export type Role = "admin" | "librarian";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string;
  publisher: string | null;
  published_year: number | null;
  cover_url: string | null;
  total_copies: number;
  available_copies: number;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  book_id: string;
  student_id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  fine_amount: number;
  status: "issued" | "returned";
  issued_by: string | null;
  created_at: string;
  updated_at: string;
  book?: Book;
  student?: Student;
}

export interface WaitingEntry {
  id: string;
  book_id: string;
  student_id: string;
  requested_at: string;
  fulfilled: boolean;
  book?: Book;
  student?: Student;
}

export interface Settings {
  id: number;
  library_name: string;
  fine_per_day: number;
  loan_period_days: number;
  max_books_per_student: number;
  updated_at: string;
}
