import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { addDays, format, isBefore } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  addToQueue, getSettings, issueBook, listBooks, listIssues, listStudents, returnBook,
} from "@/lib/lms/api";

export const Route = createFileRoute("/_authenticated/issues")({
  component: IssuesPage,
});

function IssuesPage() {
  const qc = useQueryClient();
  const [issueOpen, setIssueOpen] = useState(false);

  const activeQ = useQuery({ queryKey: ["issues", "issued"], queryFn: () => listIssues("issued") });
  const historyQ = useQuery({ queryKey: ["issues", "returned"], queryFn: () => listIssues("returned") });
  const booksQ = useQuery({ queryKey: ["books-all"], queryFn: () => listBooks() });
  const studentsQ = useQuery({ queryKey: ["students-all"], queryFn: () => listStudents() });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  const issueMut = useMutation({
    mutationFn: async (v: { bookId: string; studentId: string; dueDate: Date }) =>
      issueBook(v.bookId, v.studentId, v.dueDate),
    onSuccess: () => {
      toast.success("Book issued");
      qc.invalidateQueries();
      setIssueOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const returnMut = useMutation({
    mutationFn: returnBook,
    onSuccess: (fine) => {
      toast.success(fine > 0 ? `Returned — fine ₹${fine.toFixed(2)}` : "Returned — no fine");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const queueMut = useMutation({
    mutationFn: (v: { bookId: string; studentId: string }) => addToQueue(v.bookId, v.studentId),
    onSuccess: () => {
      toast.success("Added to waiting queue");
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = activeQ.data ?? [];
  const history = historyQ.data ?? [];
  const settings = settingsQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Issue &amp; Return</h1>
          <p className="text-muted-foreground">
            {active.length} on loan · fines at ₹{settings?.fine_per_day ?? 0}/day past due
          </p>
        </div>
        <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
          <DialogTrigger asChild><Button>Issue a book</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Issue a book</DialogTitle></DialogHeader>
            <IssueForm
              books={(booksQ.data ?? []).map((b) => ({
                id: b.id, label: `${b.title} — ${b.author}`, available: b.available_copies,
              }))}
              students={(studentsQ.data ?? []).map((s) => ({ id: s.id, label: `${s.full_name} (${s.roll_number})` }))}
              loanDays={settings?.loan_period_days ?? 14}
              onIssue={(bookId, studentId, dueDate) => issueMut.mutate({ bookId, studentId, dueDate })}
              onQueue={(bookId, studentId) => queueMut.mutate({ bookId, studentId })}
              submitting={issueMut.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">On loan ({active.length})</TabsTrigger>
          <TabsTrigger value="history">Returned ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase bg-muted/40">
                  <tr>
                    <th className="p-3">Book</th><th>Student</th><th>Issued</th><th>Due</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((i) => {
                    const overdue = isBefore(new Date(i.due_date), new Date());
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-3 font-medium">{i.book?.title}</td>
                        <td>{i.student?.full_name} <span className="text-muted-foreground">({i.student?.roll_number})</span></td>
                        <td>{format(new Date(i.issue_date), "d MMM yyyy")}</td>
                        <td className={overdue ? "text-destructive" : ""}>{format(new Date(i.due_date), "d MMM yyyy")}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${overdue ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
                            {overdue ? "Overdue" : "On loan"}
                          </span>
                        </td>
                        <td className="text-right pr-3">
                          <Button size="sm" onClick={() => returnMut.mutate(i.id)} disabled={returnMut.isPending}>Return</Button>
                        </td>
                      </tr>
                    );
                  })}
                  {active.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nothing on loan.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase bg-muted/40">
                  <tr>
                    <th className="p-3">Book</th><th>Student</th><th>Issued</th><th>Returned</th><th>Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-3 font-medium">{i.book?.title}</td>
                      <td>{i.student?.full_name}</td>
                      <td>{format(new Date(i.issue_date), "d MMM yyyy")}</td>
                      <td>{i.return_date ? format(new Date(i.return_date), "d MMM yyyy") : "—"}</td>
                      <td>{Number(i.fine_amount) > 0 ? `₹${Number(i.fine_amount).toFixed(2)}` : "—"}</td>
                    </tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No returns yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IssueForm({
  books, students, loanDays, onIssue, onQueue, submitting,
}: {
  books: { id: string; label: string; available: number }[];
  students: { id: string; label: string }[];
  loanDays: number;
  onIssue: (bookId: string, studentId: string, dueDate: Date) => void;
  onQueue: (bookId: string, studentId: string) => void;
  submitting: boolean;
}) {
  const [bookId, setBookId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), loanDays), "yyyy-MM-dd"));
  const selected = books.find((b) => b.id === bookId);
  const unavailable = !!selected && selected.available <= 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bookId || !studentId) return toast.error("Pick a book and student");
        if (unavailable) return onQueue(bookId, studentId);
        onIssue(bookId, studentId, new Date(dueDate));
      }}
    >
      <div>
        <Label>Book</Label>
        <Select value={bookId} onValueChange={setBookId}>
          <SelectTrigger><SelectValue placeholder="Select book" /></SelectTrigger>
          <SelectContent>
            {books.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label} {b.available <= 0 ? "· unavailable" : `· ${b.available} left`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {unavailable && (
          <p className="text-xs text-warning-foreground bg-warning/20 mt-2 p-2 rounded">
            No copies available — submitting will add the student to the waiting queue.
          </p>
        )}
      </div>
      <div>
        <Label>Student</Label>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
          <SelectContent>
            {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!unavailable && (
        <div>
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Working…" : unavailable ? "Add to queue" : "Issue book"}
        </Button>
      </DialogFooter>
    </form>
  );
}
