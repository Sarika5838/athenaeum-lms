import { supabase } from "@/integrations/supabase/client";
import type { Book, Issue, Settings, Student, WaitingEntry, Role } from "./types";

// Cast: DB types will regenerate; keep runtime code strongly typed via our own interfaces.
const db = supabase as any;

/* ---------- Auth / Roles ---------- */
export async function getCurrentRoles(userId: string): Promise<Role[]> {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { role: Role }) => r.role);
}

/* ---------- Books ---------- */
export async function listBooks(search = "", category = ""): Promise<Book[]> {
  let q = db.from("books").select("*").order("title");
  if (search) q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return data as Book[];
}
export async function upsertBook(book: Partial<Book>): Promise<Book> {
  const payload = { ...book };
  if (payload.available_copies === undefined && payload.total_copies !== undefined)
    payload.available_copies = payload.total_copies;
  const { data, error } = book.id
    ? await db.from("books").update(payload).eq("id", book.id).select().single()
    : await db.from("books").insert(payload).select().single();
  if (error) throw error;
  return data as Book;
}
export async function deleteBook(id: string) {
  const { error } = await db.from("books").delete().eq("id", id);
  if (error) throw error;
}
export async function listCategories(): Promise<string[]> {
  const { data, error } = await db.from("books").select("category");
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r: { category: string }) => r.category))).sort() as string[];
}

/* ---------- Students ---------- */
export async function listStudents(search = ""): Promise<Student[]> {
  let q = db.from("students").select("*").order("full_name");
  if (search)
    q = q.or(
      `full_name.ilike.%${search}%,roll_number.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`,
    );
  const { data, error } = await q;
  if (error) throw error;
  return data as Student[];
}
export async function upsertStudent(s: Partial<Student>): Promise<Student> {
  const { data, error } = s.id
    ? await db.from("students").update(s).eq("id", s.id).select().single()
    : await db.from("students").insert(s).select().single();
  if (error) throw error;
  return data as Student;
}
export async function deleteStudent(id: string) {
  const { error } = await db.from("students").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Issues ---------- */
export async function listIssues(status?: "issued" | "returned"): Promise<Issue[]> {
  let q = db
    .from("issues")
    .select("*, book:books(*), student:students(*)")
    .order("issue_date", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data as Issue[];
}
export async function issueBook(bookId: string, studentId: string, dueDate: Date): Promise<string> {
  const { data, error } = await db.rpc("issue_book", {
    _book_id: bookId,
    _student_id: studentId,
    _due_date: dueDate.toISOString(),
  });
  if (error) throw error;
  return data as string;
}
export async function returnBook(issueId: string): Promise<number> {
  const { data, error } = await db.rpc("return_book", { _issue_id: issueId });
  if (error) throw error;
  return Number(data ?? 0);
}

/* ---------- Waiting queue ---------- */
export async function listQueue(): Promise<WaitingEntry[]> {
  const { data, error } = await db
    .from("waiting_queue")
    .select("*, book:books(*), student:students(*)")
    .eq("fulfilled", false)
    .order("requested_at");
  if (error) throw error;
  return data as WaitingEntry[];
}
export async function addToQueue(bookId: string, studentId: string) {
  const { error } = await db.from("waiting_queue").insert({ book_id: bookId, student_id: studentId });
  if (error) throw error;
}
export async function removeFromQueue(id: string) {
  const { error } = await db.from("waiting_queue").update({ fulfilled: true }).eq("id", id);
  if (error) throw error;
}

/* ---------- Settings ---------- */
export async function getSettings(): Promise<Settings> {
  const { data, error } = await db.from("library_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as Settings;
}
export async function updateSettings(s: Partial<Settings>): Promise<Settings> {
  const { data, error } = await db.from("library_settings").update(s).eq("id", 1).select().single();
  if (error) throw error;
  return data as Settings;
}

/* ---------- Dashboard stats ---------- */
export interface DashboardStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  totalStudents: number;
  activeIssues: number;
  overdue: number;
  totalFines: number;
  byCategory: { name: string; count: number }[];
  recentIssues: Issue[];
}
export async function getDashboardStats(): Promise<DashboardStats> {
  const [booksRes, studentsRes, issuesRes] = await Promise.all([
    db.from("books").select("category, total_copies, available_copies"),
    db.from("students").select("id", { count: "exact", head: true }),
    db
      .from("issues")
      .select("*, book:books(*), student:students(*)")
      .order("issue_date", { ascending: false }),
  ]);
  if (booksRes.error) throw booksRes.error;
  if (issuesRes.error) throw issuesRes.error;

  const books = (booksRes.data ?? []) as { category: string; total_copies: number; available_copies: number }[];
  const issues = (issuesRes.data ?? []) as Issue[];
  const now = Date.now();
  const catMap = new Map<string, number>();
  for (const b of books) catMap.set(b.category, (catMap.get(b.category) ?? 0) + b.total_copies);

  return {
    totalBooks: books.length,
    totalCopies: books.reduce((s, b) => s + b.total_copies, 0),
    availableCopies: books.reduce((s, b) => s + b.available_copies, 0),
    totalStudents: studentsRes.count ?? 0,
    activeIssues: issues.filter((i) => i.status === "issued").length,
    overdue: issues.filter((i) => i.status === "issued" && new Date(i.due_date).getTime() < now).length,
    totalFines: issues.reduce((s, i) => s + Number(i.fine_amount || 0), 0),
    byCategory: Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    recentIssues: issues.slice(0, 6),
  };
}
