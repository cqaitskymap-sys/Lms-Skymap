"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { DEMO_EMPLOYEES, DEMO_DEPARTMENTS } from "@/lib/demo/data";
import { RequirePermission } from "@/components/auth/require-permission";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return DEMO_EMPLOYEES.filter((e) => {
      const matchSearch =
        !search ||
        `${e.firstName} ${e.lastName} ${e.email} ${e.employeeCode}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = !status || e.status === status;
      return matchSearch && matchStatus;
    });
  }, [search, status]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((e) => ({
        Code: e.employeeCode,
        Name: `${e.firstName} ${e.lastName}`,
        Email: e.email,
        Designation: e.designation,
        Status: e.status,
        Induction: e.inductionStatus,
        DOJ: e.dateOfJoining,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees.xlsx");
    toast.success("Exported to Excel");
  };

  const deptName = (id?: string) =>
    DEMO_DEPARTMENTS.find((d) => d.id === id)?.name || "—";

  return (
    <RequirePermission permission="employees:read">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Manage workforce profiles & lifecycle</p>
          </div>
        </div>

        <DataToolbar
          searchPlaceholder="Search employees…"
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          filters={[
            {
              key: "status",
              label: "Status",
              value: status,
              options: [
                { label: "Draft", value: "draft" },
                { label: "Induction", value: "induction" },
                { label: "Handed over", value: "handed_over" },
                { label: "Active", value: "active" },
              ],
            },
          ]}
          onFilterChange={(_, v) => {
            setStatus(v);
            setPage(1);
          }}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" asChild>
                <Link href="/dashboard/employees/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add employee
                </Link>
              </Button>
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} employees</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>DOJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Induction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/employees/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {e.employeeCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {e.firstName} {e.lastName}
                      <div className="text-xs text-muted-foreground">{e.email}</div>
                    </TableCell>
                    <TableCell>{deptName(e.departmentId)}</TableCell>
                    <TableCell>{e.designation}</TableCell>
                    <TableCell>{formatDate(e.dateOfJoining)}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.inductionStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} totalPages={1} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
