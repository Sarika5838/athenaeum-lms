import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listQueue, removeFromQueue } from "@/lib/lms/api";

export const Route = createFileRoute("/_authenticated/queue")({
  component: QueuePage,
});

function QueuePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["queue"], queryFn: listQueue });
  const rmMut = useMutation({
    mutationFn: removeFromQueue,
    onSuccess: () => {
      toast.success("Removed from queue");
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = r.book?.title ?? "Unknown";
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Waiting Queue</h1>
        <p className="text-muted-foreground">{rows.length} outstanding request{rows.length === 1 ? "" : "s"}</p>
      </div>

      {rows.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">The queue is empty.</Card>
      )}

      {Object.entries(grouped).map(([title, entries]) => (
        <Card key={title} className="p-5">
          <h2 className="font-display text-xl mb-3">{title}</h2>
          <ol className="space-y-2">
            {entries.map((e, idx) => (
              <li key={e.id} className="flex items-center justify-between border-b last:border-none pb-2">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-medium">{e.student?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.student?.roll_number} · requested {format(new Date(e.requested_at), "d MMM yyyy, HH:mm")}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => rmMut.mutate(e.id)}>Remove</Button>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}
