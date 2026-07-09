import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteStudent, listStudents, upsertStudent } from "@/lib/lms/api";
import type { Student } from "@/lib/lms/types";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["students", search], queryFn: () => listStudents(search) });
  const saveMut = useMutation({
    mutationFn: upsertStudent,
    onSuccess: () => {
      toast.success("Student saved");
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      toast.success("Student deleted");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const students = q.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Students</h1>
          <p className="text-muted-foreground">{students.length} registered</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-2" />Add student</Button>
      </div>

      <Card className="p-4">
        <Input placeholder="Search name, roll number, email, department…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs uppercase bg-muted/40">
              <tr>
                <th className="p-3">Name</th><th>Roll</th><th>Email</th><th>Phone</th><th>Department</th><th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td>{s.roll_number}</td>
                  <td className="text-muted-foreground">{s.email}</td>
                  <td>{s.phone}</td>
                  <td>{s.department}</td>
                  <td className="text-right pr-3">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(`Delete ${s.full_name}?`)) delMut.mutate(s.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
          {editing && (
            <form
              className="grid grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload: Partial<Student> = {
                  ...editing,
                  full_name: String(fd.get("full_name") ?? "").trim(),
                  roll_number: String(fd.get("roll_number") ?? "").trim(),
                  email: (String(fd.get("email") ?? "").trim() || null) as string | null,
                  phone: (String(fd.get("phone") ?? "").trim() || null) as string | null,
                  department: (String(fd.get("department") ?? "").trim() || null) as string | null,
                };
                if (!payload.full_name || !payload.roll_number) return toast.error("Name and roll number required");
                saveMut.mutate(payload);
              }}
            >
              <div className="col-span-2"><Label>Full name</Label><Input name="full_name" defaultValue={editing.full_name ?? ""} required /></div>
              <div><Label>Roll number</Label><Input name="roll_number" defaultValue={editing.roll_number ?? ""} required /></div>
              <div><Label>Department</Label><Input name="department" defaultValue={editing.department ?? ""} /></div>
              <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing.email ?? ""} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing.phone ?? ""} /></div>
              <DialogFooter className="col-span-2">
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
