import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Pencil, Plus, Trash2, Upload, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { deleteBook, listBooks, listCategories, upsertBook } from "@/lib/lms/api";
import type { Book } from "@/lib/lms/types";

export const Route = createFileRoute("/_authenticated/books")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
  component: BooksPage,
});

function BooksPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Book> | null>(null);
  const qc = useQueryClient();

  const booksQ = useQuery({
    queryKey: ["books", search, category],
    queryFn: () => listBooks(search, category === "all" ? "" : category),
  });
  const catsQ = useQuery({ queryKey: ["book-categories"], queryFn: listCategories });

  const saveMut = useMutation({
    mutationFn: upsertBook,
    onSuccess: () => {
      toast.success("Book saved");
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["book-categories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      toast.success("Book deleted");
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const books = booksQ.data ?? [];
  const stats = useMemo(
    () => ({
      total: books.length,
      copies: books.reduce((s, b) => s + b.total_copies, 0),
      available: books.reduce((s, b) => s + b.available_copies, 0),
    }),
    [books],
  );

  const exportExcel = () => {
    const rows = books.map((b) => ({
      Title: b.title, Author: b.author, ISBN: b.isbn, Category: b.category,
      Publisher: b.publisher, Year: b.published_year, Total: b.total_copies, Available: b.available_copies,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Books");
    XLSX.writeFile(wb, `books-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      let ok = 0, failed = 0;
      for (const r of rows) {
        try {
          await upsertBook({
            title: String(r.Title ?? r.title ?? "").trim(),
            author: String(r.Author ?? r.author ?? "").trim(),
            isbn: r.ISBN ? String(r.ISBN).trim() : null,
            category: String(r.Category ?? r.category ?? "General").trim() || "General",
            publisher: r.Publisher ? String(r.Publisher).trim() : null,
            published_year: r.Year ? Number(r.Year) : null,
            total_copies: Number(r.Total ?? r.total_copies ?? 1),
            available_copies: Number(r.Available ?? r.available_copies ?? r.Total ?? 1),
          });
          ok++;
        } catch { failed++; }
      }
      toast.success(`Imported ${ok} rows${failed ? `, ${failed} failed` : ""}`);
      qc.invalidateQueries({ queryKey: ["books"] });
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Books</h1>
          <p className="text-muted-foreground">{stats.total} titles · {stats.available}/{stats.copies} copies available</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm cursor-pointer hover:bg-muted">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }}/>
          </label>
          <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button onClick={() => setEditing({ total_copies: 1, category: "General" })}>
            <Plus className="h-4 w-4 mr-2" />Add book
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-3">
        <Input placeholder="Search title, author, ISBN…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(catsQ.data ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs uppercase bg-muted/40">
              <tr>
                <th className="p-3">Cover</th><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th>
                <th>Year</th><th>Available</th><th></th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3">
                    {b.cover_url ? (
                      <img src={b.cover_url} alt={b.title} className="h-16 w-12 object-cover rounded-sm shadow-sm" />
                    ) : (
                      <div className="h-16 w-12 rounded-sm bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                    )}
                  </td>
                  <td className="font-medium">{b.title}</td>
                  <td>{b.author}</td>
                  <td className="text-muted-foreground">{b.isbn}</td>
                  <td>{b.category}</td>
                  <td>{b.published_year ?? ""}</td>
                  <td>{b.available_copies}/{b.total_copies}</td>
                  <td className="text-right pr-3">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(`Delete "${b.title}"?`)) delMut.mutate(b.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {books.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No books match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit book" : "Add book"}</DialogTitle></DialogHeader>
          {editing && (
            <form
              className="grid grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload: Partial<Book> = {
                  ...editing,
                  title: String(fd.get("title") ?? "").trim(),
                  author: String(fd.get("author") ?? "").trim(),
                  isbn: (String(fd.get("isbn") ?? "").trim() || null) as string | null,
                  category: String(fd.get("category") ?? "General").trim() || "General",
                  publisher: (String(fd.get("publisher") ?? "").trim() || null) as string | null,
                  published_year: fd.get("year") ? Number(fd.get("year")) : null,
                  cover_url: (String(fd.get("cover_url") ?? "").trim() || null) as string | null,
                  total_copies: Number(fd.get("total_copies") ?? 1),
                };
                if (!editing.id) payload.available_copies = payload.total_copies;
                if (!payload.title || !payload.author) return toast.error("Title and author are required");
                saveMut.mutate(payload);
              }}
            >
              <div className="col-span-2"><Label>Title</Label><Input name="title" defaultValue={editing.title ?? ""} required /></div>
              <div className="col-span-2"><Label>Author</Label><Input name="author" defaultValue={editing.author ?? ""} required /></div>
              <div><Label>ISBN</Label><Input name="isbn" defaultValue={editing.isbn ?? ""} /></div>
              <div><Label>Category</Label><Input name="category" defaultValue={editing.category ?? "General"} /></div>
              <div><Label>Publisher</Label><Input name="publisher" defaultValue={editing.publisher ?? ""} /></div>
              <div><Label>Year</Label><Input name="year" type="number" defaultValue={editing.published_year ?? ""} /></div>
              <div className="col-span-2"><Label>Cover URL</Label><Input name="cover_url" defaultValue={editing.cover_url ?? ""} /></div>
              <div><Label>Total copies</Label><Input name="total_copies" type="number" min={0} defaultValue={editing.total_copies ?? 1} required /></div>
              <DialogFooter className="col-span-2 mt-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
