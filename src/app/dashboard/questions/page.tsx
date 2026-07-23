"use client";

import { DEMO_QUESTIONS } from "@/lib/demo/data";
import { RequirePermission } from "@/components/auth/require-permission";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function QuestionsPage() {
  return (
    <RequirePermission permission="questions:read">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">MCQ / True-False items for assessments</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{DEMO_QUESTIONS.length} questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_QUESTIONS.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md">{q.text}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{q.type}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{q.difficulty}</TableCell>
                    <TableCell>{q.marks}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.tags.join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
