"use client";

import { useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useQuestionBank } from "@/hooks/use-assessment";
import { deleteQuestion } from "@/lib/services/assessments";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AiGenerateQuestionsDialog } from "@/components/ai/ai-generate-questions-dialog";
import { CreateQuestionBankDialog } from "@/components/exams/create-question-bank-dialog";
import { CreateQuestionDialog } from "@/components/exams/create-question-dialog";
import { QuestionTypeBadge } from "@/components/exams/question-renderer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

export default function QuestionsPage() {
  const [bankId, setBankId] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const filters = useMemo(
    () => ({
      bankId: bankId === "all" ? undefined : bankId,
      difficulty: difficulty === "all" ? undefined : difficulty,
      type: type === "all" ? undefined : type,
    }),
    [bankId, difficulty, type]
  );

  const { banks, questions, loading, refresh } = useQuestionBank(filters);

  return (
    <RequirePermission permission="questions:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
            <p className="text-muted-foreground">
              MCQ · True/False · Multi-select · Scenario · Image · difficulty levels
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CreateQuestionBankDialog
              onCreated={(id) => {
                void refresh();
                setBankId(id);
              }}
            />
            <CreateQuestionDialog
              banks={banks}
              defaultBankId={bankId !== "all" ? bankId : banks[0]?.id}
              onCreated={() => void refresh()}
            />
            <AiGenerateQuestionsDialog banks={banks} onSaved={refresh} />
          </div>
        </div>

        {banks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No question banks yet</p>
              <p className="text-sm text-muted-foreground">
                Pehle bank banao, phir questions add karo (manual ya AI).
              </p>
              <Can permission="questions:write">
                <CreateQuestionBankDialog
                  onCreated={(id) => {
                    void refresh();
                    setBankId(id);
                  }}
                />
              </Can>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {banks.map((b) => (
              <Card
                key={b.id}
                className={
                  bankId === b.id ? "cursor-pointer ring-1 ring-primary/40" : "cursor-pointer"
                }
                onClick={() => setBankId(b.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{b.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {b.questionCount} active questions
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
            <CardDescription>{questions.length} matching items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Bank</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All banks</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="multi_select">Multi select</SelectItem>
                    <SelectItem value="scenario">Scenario</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {banks.length
                    ? "Is bank mein abhi koi question nahi hai."
                    : "Pehle ek question bank create karo."}
                </p>
                {banks.length > 0 && (
                  <CreateQuestionDialog
                    banks={banks}
                    defaultBankId={bankId !== "all" ? bankId : banks[0]?.id}
                    onCreated={() => void refresh()}
                  />
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>−ve</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2">{q.text}</p>
                        {q.scenario && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                            Scenario: {q.scenario.title || q.scenario.narrative}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <QuestionTypeBadge type={q.type} />
                      </TableCell>
                      <TableCell className="capitalize">{q.difficulty}</TableCell>
                      <TableCell>{q.marks}</TableCell>
                      <TableCell>{q.negativeMarks ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {q.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AdminDeleteButton
                          confirmTitle="Delete question?"
                          confirmDescription="This question will be removed from the bank permanently."
                          successMessage="Question deleted"
                          onDelete={async () => {
                            await deleteQuestion(q.id);
                            await refresh();
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
