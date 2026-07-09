import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listBooks, listIssues, listStudents } from "@/lib/lms/api";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type Row = Record<string, string | number | null | undefined>;

function toExcel(name: string, rows: Row[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
  XLSX.writeFile(wb, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function toPDF(title: string, headers: string[], rows: (string | number)[][]) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(16); doc.text(title, 14, 16);
  doc.setFontSize(10); doc.text(`Generated ${format(new Date(), "d MMM yyyy, HH:mm")}`, 14, 22);
  autoTable(doc, { head: [headers], body: rows, startY: 28, styles: { fontSize: 9 }, headStyles: { fillColor: [40, 55, 100] } });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function ReportCard({ title, description, onExcel, onPDF, disabled }: {
  title: string; description: string; onExcel: () => void; onPDF: () => void; disabled?: boolean;
}) {
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div>
        <h3 className="font-display text-xl">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2 mt-auto">
        <Button variant="outline" onClick={onExcel} disabled={disabled}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
        </Button>
        <Button variant="outline" onClick={onPDF} disabled={disabled}>
          <FileDown className="h-4 w-4 mr-2" />PDF
        </Button>
      </div>
    </Card>
  );
}

function ReportsPage() {
  const booksQ = useQuery({ queryKey: ["books-all"], queryFn: () => listBooks() });
  const studentsQ = useQuery({ queryKey: ["students-all"], queryFn: () => listStudents() });
  const issuedQ = useQuery({ queryKey: ["issues", "issued"], queryFn: () => listIssues("issued") });
  const returnedQ = useQuery({ queryKey: ["issues", "returned"], queryFn: () => listIssues("returned") });

  const now = new Date();
  const overdue = (issuedQ.data ?? []).filter((i) => new Date(i.due_date) < now);
  const disabled = booksQ.isLoading || studentsQ.isLoading || issuedQ.isLoading || returnedQ.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Reports</h1>
        <p className="text-muted-foreground">Export catalog, registry, and circulation records.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard
          title="Book catalog"
          description={`${booksQ.data?.length ?? 0} titles across the library.`}
          disabled={disabled}
          onExcel={() => toExcel("book-catalog", (booksQ.data ?? []).map((b) => ({
            Title: b.title, Author: b.author, ISBN: b.isbn, Category: b.category,
            Publisher: b.publisher, Year: b.published_year, Total: b.total_copies, Available: b.available_copies,
          })))}
          onPDF={() => toPDF("Book Catalog", ["Title", "Author", "ISBN", "Category", "Year", "Avail/Total"],
            (booksQ.data ?? []).map((b) => [b.title, b.author, b.isbn ?? "", b.category, b.published_year ?? "", `${b.available_copies}/${b.total_copies}`]))}
        />
        <ReportCard
          title="Student registry"
          description={`${studentsQ.data?.length ?? 0} students on record.`}
          disabled={disabled}
          onExcel={() => toExcel("student-registry", (studentsQ.data ?? []).map((s) => ({
            Name: s.full_name, Roll: s.roll_number, Email: s.email, Phone: s.phone, Department: s.department,
          })))}
          onPDF={() => toPDF("Student Registry", ["Name", "Roll", "Email", "Phone", "Department"],
            (studentsQ.data ?? []).map((s) => [s.full_name, s.roll_number, s.email ?? "", s.phone ?? "", s.department ?? ""]))}
        />
        <ReportCard
          title="Books on loan"
          description={`${issuedQ.data?.length ?? 0} currently on loan.`}
          disabled={disabled}
          onExcel={() => toExcel("books-on-loan", (issuedQ.data ?? []).map((i) => ({
            Book: i.book?.title, Student: i.student?.full_name, Roll: i.student?.roll_number,
            Issued: format(new Date(i.issue_date), "yyyy-MM-dd"), Due: format(new Date(i.due_date), "yyyy-MM-dd"),
          })))}
          onPDF={() => toPDF("Books on Loan", ["Book", "Student", "Roll", "Issued", "Due"],
            (issuedQ.data ?? []).map((i) => [i.book?.title ?? "", i.student?.full_name ?? "", i.student?.roll_number ?? "",
              format(new Date(i.issue_date), "yyyy-MM-dd"), format(new Date(i.due_date), "yyyy-MM-dd")]))}
        />
        <ReportCard
          title="Overdue books"
          description={`${overdue.length} overdue right now.`}
          disabled={disabled}
          onExcel={() => toExcel("overdue-books", overdue.map((i) => ({
            Book: i.book?.title, Student: i.student?.full_name, Roll: i.student?.roll_number,
            Due: format(new Date(i.due_date), "yyyy-MM-dd"),
            DaysLate: Math.max(0, Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000)),
          })))}
          onPDF={() => toPDF("Overdue Books", ["Book", "Student", "Roll", "Due", "Days late"],
            overdue.map((i) => [i.book?.title ?? "", i.student?.full_name ?? "", i.student?.roll_number ?? "",
              format(new Date(i.due_date), "yyyy-MM-dd"),
              Math.max(0, Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000))]))}
        />
        <ReportCard
          title="Returns & fines"
          description={`${returnedQ.data?.length ?? 0} returns. Total fines ₹${(returnedQ.data ?? []).reduce((s, i) => s + Number(i.fine_amount), 0).toFixed(2)}.`}
          disabled={disabled}
          onExcel={() => toExcel("returns-fines", (returnedQ.data ?? []).map((i) => ({
            Book: i.book?.title, Student: i.student?.full_name,
            Issued: format(new Date(i.issue_date), "yyyy-MM-dd"),
            Returned: i.return_date ? format(new Date(i.return_date), "yyyy-MM-dd") : "",
            Fine: Number(i.fine_amount).toFixed(2),
          })))}
          onPDF={() => toPDF("Returns & Fines", ["Book", "Student", "Issued", "Returned", "Fine"],
            (returnedQ.data ?? []).map((i) => [i.book?.title ?? "", i.student?.full_name ?? "",
              format(new Date(i.issue_date), "yyyy-MM-dd"),
              i.return_date ? format(new Date(i.return_date), "yyyy-MM-dd") : "",
              `Rs. ${Number(i.fine_amount).toFixed(2)}`]))}
        />
      </div>
    </div>
  );
}
