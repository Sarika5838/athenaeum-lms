import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { BookOpen, Users, ArrowLeftRight, AlertTriangle, IndianRupee, Library } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/lms/api";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Stat({ icon: Icon, label, value, hint, tone = "default" }: {
  icon: React.ElementType; label: string; value: string | number; hint?: string; tone?: "default" | "warn" | "success";
}) {
  const toneClass = tone === "warn" ? "text-destructive" : tone === "success" ? "text-success" : "text-primary";
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={`h-11 w-11 rounded-lg bg-muted flex items-center justify-center ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-display text-3xl mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboardStats });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Dashboard</h1>
        <p className="text-muted-foreground">A quiet overview of the library today.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={BookOpen} label="Titles" value={data.totalBooks} hint={`${data.totalCopies} total copies`} />
        <Stat icon={Library} label="Available" value={data.availableCopies} hint="ready to loan" tone="success" />
        <Stat icon={Users} label="Students" value={data.totalStudents} />
        <Stat icon={ArrowLeftRight} label="On loan" value={data.activeIssues} />
        <Stat icon={AlertTriangle} label="Overdue" value={data.overdue} tone="warn" />
        <Stat icon={IndianRupee} label="Fines collected" value={`₹${data.totalFines.toFixed(2)}`} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display text-xl mb-4">Copies by category</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.byCategory}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-xl mb-4">Category share</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.byCategory} dataKey="count" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={3}>
                  {data.byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-xl mb-4">Recent activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs uppercase">
              <tr className="border-b">
                <th className="py-2">Book</th><th>Student</th><th>Issued</th><th>Due</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentIssues.map((i) => (
                <tr key={i.id} className="border-b last:border-none">
                  <td className="py-3 font-medium">{i.book?.title ?? "—"}</td>
                  <td>{i.student?.full_name ?? "—"}</td>
                  <td>{format(new Date(i.issue_date), "d MMM yyyy")}</td>
                  <td>{format(new Date(i.due_date), "d MMM yyyy")}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      i.status === "returned" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                    }`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
              {data.recentIssues.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
