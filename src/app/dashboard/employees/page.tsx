"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Download, Loader2 } from "lucide-react";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useLifecycleDirectory } from "@/hooks/use-employee-lifecycle";
import { deleteEmployeeLifecycle } from "@/lib/services/lifecycle";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { LifecycleProgressBar } from "@/components/lifecycle/lifecycle-progress-bar";
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
import type { Department } from "@/types";

export default function EmployeesPage() {
  const { employees, loading, error, refresh } = useLifecycleDirectory();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const pageSize = 10;

  useEffect(() => {
    void listDepartments().then(setDepartments);
  }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        !search ||
        `${e.firstName} ${e.lastName} ${e.email} ${e.employeeCode}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const stage = e.lifecycleStage || "created";
      const matchStatus = !status || stage === status;
      return matchSearch && matchStatus;
    });
  }, [employees, search, status]);

  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((e) => ({
        Code: e.employeeCode,
        Name: `${e.firstName} ${e.lastName}`,
        Email: e.email,
        Designation: e.designation,
        Status: e.status,
        Lifecycle: e.lifecycleStage,
        Progress: e.lifecycleProgress,
        Induction: e.inductionStatus,
        DOJ: e.dateOfJoining,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees.xlsx");
    toast.success("Exported to Excel");
  };

  const deptName = (id?: string) => departmentLabel(departments, id);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <RequirePermission permission="employees:read">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <p className="font-medium text-destructive">Could not load employees</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="employees:read">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Manage workforce profiles & lifecycle</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Can permission="employees:write">
              <Button asChild>
                <Link href="/dashboard/employees/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Onboard employee
                </Link>
              </Button>
            </Can>
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
                { label: "Pending verification", value: "hr_verification" },
                { label: "Induction assigned", value: "induction_assigned" },
                { label: "Induction completed", value: "induction_completed" },
                { label: "Handed over", value: "department_handover" },
                { label: "In training", value: "training" },
                { label: "Qualified", value: "qualified" },
              ],
            },
          ]}
          onFilterChange={(key, value) => {
            if (key === "status") {
              setStatus(value);
              setPage(1);
            }
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>Directory ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>DOJ</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {employees.length === 0
                        ? "No employees yet. Onboard your first hire to get started."
                        : "No employees match your search or filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.map((e) => (
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
                    </TableCell>
                    <TableCell>{deptName(e.departmentId)}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.lifecycleStage || e.status} />
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <LifecycleProgressBar
                        stage={e.lifecycleStage || "created"}
                        progress={e.lifecycleProgress}
                        showLabel={false}
                      />
                    </TableCell>
                    <TableCell>{formatDate(e.dateOfJoining)}</TableCell>
                    <TableCell>
                      <AdminDeleteButton
                        confirmTitle={`Delete ${e.firstName} ${e.lastName}?`}
                        confirmDescription="Employee profile, lifecycle records, and linked login account (if any) will be removed permanently."
                        successMessage="Employee deleted"
                        onDelete={async () => {
                          await deleteEmployeeLifecycle(e.id);
                          await refresh();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="mt-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
