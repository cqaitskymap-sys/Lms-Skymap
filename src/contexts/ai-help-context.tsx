"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AiHelpContextValue {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  pendingQuestion: string | null;
  consumePendingQuestion: () => string | null;
  chatAvailable: boolean;
  setChatAvailable: (available: boolean) => void;
  askAboutField: (fieldLabel: string, extra?: string) => void;
  askQuestion: (question: string) => void;
}

const AiHelpContext = createContext<AiHelpContextValue | undefined>(undefined);

export function AiHelpProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [chatAvailable, setChatAvailable] = useState(false);

  const consumePendingQuestion = useCallback(() => {
    const q = pendingQuestion;
    setPendingQuestion(null);
    return q;
  }, [pendingQuestion]);

  const askQuestion = useCallback((question: string) => {
    const text = question.trim();
    if (!text) return;
    setPendingQuestion(text);
    setChatOpen(true);
  }, []);

  const askAboutField = useCallback(
    (fieldLabel: string, extra?: string) => {
      const name = fieldLabel.replace(/\s+/g, " ").trim() || "this field";
      const question = extra?.trim()
        ? extra.trim()
        : `Is field ka naam "${name}" hai. Ye field kyun aaya hai, required hai kya, aur isme kya add/bharna chahiye? Example ke saath short mein batao.`;
      askQuestion(question);
    },
    [askQuestion]
  );

  const value = useMemo(
    () => ({
      chatOpen,
      setChatOpen,
      pendingQuestion,
      consumePendingQuestion,
      chatAvailable,
      setChatAvailable,
      askAboutField,
      askQuestion,
    }),
    [
      chatOpen,
      pendingQuestion,
      consumePendingQuestion,
      chatAvailable,
      askAboutField,
      askQuestion,
    ]
  );

  return <AiHelpContext.Provider value={value}>{children}</AiHelpContext.Provider>;
}

export function useAiHelp() {
  const ctx = useContext(AiHelpContext);
  if (!ctx) throw new Error("useAiHelp must be used within AiHelpProvider");
  return ctx;
}

export function useAiHelpOptional() {
  return useContext(AiHelpContext);
}
