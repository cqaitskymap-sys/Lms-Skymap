"use client";

import { Trophy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  examTitle?: string;
  highlightEmployeeId?: string;
}

export function LeaderboardTable({
  entries,
  examTitle,
  highlightEmployeeId,
}: LeaderboardTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
        </CardTitle>
        {examTitle && <CardDescription>{examTitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        {!entries.length ? (
          <p className="text-sm text-muted-foreground">No completed attempts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow
                  key={e.attemptId}
                  className={
                    e.employeeId === highlightEmployeeId ? "bg-primary/5" : undefined
                  }
                >
                  <TableCell className="font-mono font-semibold">#{e.rank}</TableCell>
                  <TableCell>{e.employeeName}</TableCell>
                  <TableCell>
                    {e.percentage}% ({e.score})
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {Math.floor(e.timeSpentSeconds / 60)}m {e.timeSpentSeconds % 60}s
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.passed ? "default" : "secondary"}>
                      {e.passed ? "Passed" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
