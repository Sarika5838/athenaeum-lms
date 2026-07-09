import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, updateSettings } from "@/lib/lms/api";
import { useAuth } from "@/lib/lms/auth";
import { useTheme } from "@/lib/lms/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const mut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = q.data;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="text-muted-foreground">Library policies and account preferences.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Library policies</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {isAdmin ? "Only Admins can change these." : "Read-only — ask an Admin to change these."}
        </p>
        {s && (
          <form
            className="grid grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              mut.mutate({
                library_name: String(fd.get("library_name")),
                fine_per_day: Number(fd.get("fine_per_day")),
                loan_period_days: Number(fd.get("loan_period_days")),
                max_books_per_student: Number(fd.get("max_books_per_student")),
              });
            }}
          >
            <div className="col-span-2">
              <Label>Library name</Label>
              <Input name="library_name" defaultValue={s.library_name} disabled={!isAdmin} />
            </div>
            <div>
              <Label>Fine per day (₹)</Label>
              <Input name="fine_per_day" type="number" step="0.01" min={0} defaultValue={s.fine_per_day} disabled={!isAdmin} />
            </div>
            <div>
              <Label>Loan period (days)</Label>
              <Input name="loan_period_days" type="number" min={1} defaultValue={s.loan_period_days} disabled={!isAdmin} />
            </div>
            <div>
              <Label>Max books per student</Label>
              <Input name="max_books_per_student" type="number" min={1} defaultValue={s.max_books_per_student} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <div className="col-span-2 flex justify-end">
                <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Saving…" : "Save changes"}</Button>
              </div>
            )}
          </form>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground mb-4">Switch between warm light mode and quiet dark mode.</p>
        <Button variant="outline" onClick={toggle}>Currently: {theme} — toggle</Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Your account</h2>
        <div className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Name:</span> {user?.fullName}</div>
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Role:</span> {isAdmin ? "Admin" : "Librarian"}</div>
        </div>
      </Card>
    </div>
  );
}
