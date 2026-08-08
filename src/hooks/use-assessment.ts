"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getExamAnalytics,
  getLeaderboard,
  listExams,
  listQuestionBanks,
  listQuestions,
} from "@/lib/services/assessments";
import { ASSESSMENT_UPDATED_EVENT } from "@/lib/assessments/demo-store";
import type {
  AssessmentAnalytics,
  Exam,
  LeaderboardEntry,
  Question,
  QuestionBank,
} from "@/types";

export function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setExams(await listExams());
    } catch (err) {
      console.warn("[useExams] refresh failed:", err);
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { exams, loading, refresh };
}

export function useQuestionBank(filters?: {
  bankId?: string;
  difficulty?: string;
  type?: string;
}) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, q] = await Promise.all([
        listQuestionBanks(),
        listQuestions(filters),
      ]);
      setBanks(b);
      setQuestions(q);
    } catch (err) {
      console.warn("[useQuestionBank] refresh failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load question bank");
      setBanks([]);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.bankId, filters?.difficulty, filters?.type]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { banks, questions, loading, error, refresh };
}

export function useExamLeaderboard(examId: string | undefined) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      setEntries(await getLeaderboard(examId));
    } catch (err) {
      console.warn("[useExamLeaderboard] refresh failed:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { entries, loading, refresh };
}

export function useExamAnalytics(examId: string | undefined) {
  const [analytics, setAnalytics] = useState<AssessmentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      setAnalytics(await getExamAnalytics(examId));
    } catch (err) {
      console.warn("[useExamAnalytics] refresh failed:", err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { analytics, loading, refresh };
}
