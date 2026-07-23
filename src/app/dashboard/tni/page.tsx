"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/auth/require-permission";
import { DEMO_SOPS } from "@/lib/demo/data";

interface NeedRow {
  id: string;
  topic: string;
  sopId: string;
  priority: string;
  rationale: string;
}

export default function TniPage() {
  const [needs, setNeeds] = useState<NeedRow[]>([
    {
      id: "1",
      topic: "Document Control",
      sopId: "sop_001",
      priority: "high",
      rationale: "Core QA responsibility per JD",
    },
  ]);

  const addNeed = () =>
    setNeeds((n) => [
      ...n,
      { id: crypto.randomUUID(), topic: "", sopId: "", priority: "medium", rationale: "" },
    ]);

  return (
    <RequirePermission permission={["tni:read", "tni:write"]}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Need Identification</h1>
          <p className="text-muted-foreground">Map JD responsibilities to SOP training needs</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>TNI form</CardTitle>
            <CardDescription>Created by Department Head after JD approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input defaultValue="emp_001" />
              </div>
              <div className="space-y-2">
                <Label>Linked JD ID</Label>
                <Input defaultValue="jd_001" />
              </div>
            </div>

            {needs.map((need, idx) => (
              <div key={need.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Need #{idx + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setNeeds((n) => n.filter((x) => x.id !== need.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Topic</Label>
                    <Input
                      value={need.topic}
                      onChange={(e) =>
                        setNeeds((n) =>
                          n.map((x) => (x.id === need.id ? { ...x, topic: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Related SOP</Label>
                    <Select
                      value={need.sopId}
                      onValueChange={(v) =>
                        setNeeds((n) =>
                          n.map((x) => (x.id === need.id ? { ...x, sopId: v } : x))
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SOP" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEMO_SOPS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.sopNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={need.priority}
                      onValueChange={(v) =>
                        setNeeds((n) =>
                          n.map((x) => (x.id === need.id ? { ...x, priority: v } : x))
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Rationale</Label>
                    <Textarea
                      rows={2}
                      value={need.rationale}
                      onChange={(e) =>
                        setNeeds((n) =>
                          n.map((x) =>
                            x.id === need.id ? { ...x, rationale: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={addNeed}>
                <Plus className="mr-2 h-4 w-4" />
                Add need
              </Button>
              <Button
                onClick={() => toast.success("TNI submitted for approval")}
              >
                Submit TNI
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
