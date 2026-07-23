"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DEMO_EXAMS, DEMO_QUESTIONS } from "@/lib/demo/data";
import { ExamTimer } from "@/components/exams/exam-timer";
import { shuffleArray, calculatePercentage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

type Phase = "list" | "exam" | "result";

export default function ExamsPage() {
  const [phase, setPhase] = useState<Phase>("list");
  const [examId, setExamId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ percentage: number; passed: boolean } | null>(null);
  const [expiresAt, setExpiresAt] = useState("");

  const exam = DEMO_EXAMS.find((e) => e.id === examId);

  const questions = useMemo(() => {
    if (!exam) return [];
    let qs = [...DEMO_QUESTIONS];
    if (exam.shuffleQuestions) qs = shuffleArray(qs);
    return qs.slice(0, exam.questionCount).map((q) => ({
      ...q,
      options: exam.shuffleOptions
        ? shuffleArray(q.options.map((o) => ({ id: o.id, text: o.text })))
        : q.options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    }));
  }, [exam]);

  const startExam = (id: string) => {
    const e = DEMO_EXAMS.find((x) => x.id === id)!;
    setExamId(id);
    setAnswers({});
    setResult(null);
    setExpiresAt(new Date(Date.now() + e.durationMinutes * 60 * 1000).toISOString());
    setPhase("exam");
  };

  const toggleAnswer = (qid: string, oid: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qid] || [];
      if (multi) {
        return {
          ...prev,
          [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid],
        };
      }
      return { ...prev, [qid]: [oid] };
    });
  };

  const submit = useCallback(() => {
    if (!exam) return;
    let total = 0;
    let earned = 0;
    for (const q of questions) {
      total += q.marks;
      const selected = new Set(answers[q.id] || []);
      const correct = new Set(q.correctOptionIds);
      const ok =
        selected.size === correct.size && [...correct].every((id) => selected.has(id));
      if (ok) earned += q.marks;
    }
    const percentage = calculatePercentage(earned, total);
    const passed = percentage >= exam.passPercentage;
    setResult({ percentage, passed });
    setPhase("result");
    if (passed) {
      toast.success(`Passed with ${percentage}% — certificate will be generated`);
    } else {
      toast.error(`Failed with ${percentage}% — retraining scheduled automatically`);
    }
  }, [answers, exam, questions]);

  const onExpire = useCallback(() => {
    toast.warning("Time expired — submitting automatically");
    submit();
  }, [submit]);

  if (phase === "result" && result && exam) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assessment result</CardTitle>
            <CardDescription>{exam.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-5xl font-bold tracking-tight">{result.percentage}%</p>
            <p className={result.passed ? "text-success font-semibold" : "text-destructive font-semibold"}>
              {result.passed ? "PASSED" : "FAILED"}
            </p>
            <p className="text-sm text-muted-foreground">
              Pass mark: {exam.passPercentage}%
              {!result.passed && " · Retraining has been auto-scheduled"}
            </p>
            <Button onClick={() => setPhase("list")}>Back to exams</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "exam" && exam) {
    const answered = Object.keys(answers).length;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">
              {answered}/{questions.length} answered · Pass ≥ {exam.passPercentage}%
            </p>
          </div>
          <ExamTimer expiresAt={expiresAt} onExpire={onExpire} />
        </div>
        <Progress value={(answered / questions.length) * 100} />

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Q{idx + 1}. {q.text}
                </CardTitle>
                <CardDescription>
                  {q.marks} mark{q.marks > 1 ? "s" : ""} · {q.type.replace("_", " ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.options.map((o) => {
                  const selected = (answers[q.id] || []).includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() =>
                          toggleAnswer(q.id, o.id, q.type === "multi_select")
                        }
                      />
                      <Label className="cursor-pointer font-normal">{o.text}</Label>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button size="lg" onClick={submit}>
          Submit assessment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exams</h1>
        <p className="text-muted-foreground">Timed assessments with randomized questions</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {DEMO_EXAMS.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle className="text-base">{e.title}</CardTitle>
              <CardDescription>{e.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {e.questionCount} questions · {e.durationMinutes} min · Pass {e.passPercentage}%
              </div>
              <Button size="sm" onClick={() => startExam(e.id)}>
                Start
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
