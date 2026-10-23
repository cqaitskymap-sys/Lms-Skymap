"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDepartments } from "@/hooks/use-departments";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  snapshotFromMaster,
  type JdMasterRecord,
} from "@/lib/jd/catalog-master";
import { builtinCatalogSnapshot, type JdCatalogSnapshot } from "@/lib/jd/responsibility-catalog";
import { deleteJdMaster, listJdMasters, saveJdMaster } from "@/lib/services/jd-catalog";

const DEPARTMENT_LEVEL = "__department__";

function cloneDraft(draft: JdCatalogSnapshot): JdCatalogSnapshot {
  return JSON.parse(JSON.stringify(draft)) as JdCatalogSnapshot;
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function JdMastersPage() {
  const { profile } = useAuth();
  const { activeDepartments, loading: departmentsLoading } = useDepartments();
  const [masters, setMasters] = useState<JdMasterRecord[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [departmentId, setDepartmentId] = useState("");
  const [draft, setDraft] = useState<JdCatalogSnapshot | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sectionKey, setSectionKey] = useState(DEPARTMENT_LEVEL);
  const [designationId, setDesignationId] = useState("");
  const [sectionDraft, setSectionDraft] = useState("");
  const [designationDraft, setDesignationDraft] = useState("");
  const [renameSection, setRenameSection] = useState("");
  const [renameDesignation, setRenameDesignation] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.role === "super_admin";

  useEffect(() => {
    let cancelled = false;
    listJdMasters()
      .then((rows) => {
        if (!cancelled) setMasters(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load saved lists");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMasters(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDepartment = useMemo(
    () => activeDepartments.find((row) => row.id === departmentId) || null,
    [activeDepartments, departmentId]
  );

  function loadDepartment(nextId: string) {
    if (dirty && !window.confirm("Discard unsaved changes for this department?")) return;
    setDepartmentId(nextId);
    setSectionDraft("");
    setDesignationDraft("");
    const dept = activeDepartments.find((row) => row.id === nextId);
    if (!dept) {
      setDraft(null);
      return;
    }
    const saved = snapshotFromMaster(masters.find((row) => row.departmentId === nextId));
    const next = saved ?? builtinCatalogSnapshot(dept);
    setUsingSaved(Boolean(saved));
    setDraft(cloneDraft(next));
    setDirty(false);
    const firstSection = next.sections[0]?.name;
    setSectionKey(firstSection || DEPARTMENT_LEVEL);
    const firstDesignation = firstSection
      ? next.sections[0]?.designations[0]?.id
      : next.designations[0]?.id;
    setDesignationId(firstDesignation || "");
    setRenameSection(firstSection || "");
    setRenameDesignation(
      (firstSection ? next.sections[0]?.designations[0] : next.designations[0])?.designation || ""
    );
  }

  function mark(next: JdCatalogSnapshot) {
    setDraft(next);
    setDirty(true);
  }

  function updateDesignations(
    nextRows:
      | JdCatalogSnapshot["designations"]
      | ((rows: JdCatalogSnapshot["designations"]) => JdCatalogSnapshot["designations"])
  ) {
    const key = sectionKey;
    setDraft((current) => {
      if (!current) return current;
      const rows =
        key === DEPARTMENT_LEVEL
          ? current.designations
          : current.sections.find((section) => section.name === key)?.designations || [];
      const resolved = typeof nextRows === "function" ? nextRows(rows) : nextRows;
      if (key === DEPARTMENT_LEVEL) return { ...current, designations: resolved };
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.name === key ? { ...section, designations: resolved } : section
        ),
      };
    });
    setDirty(true);
  }

  const sectionIndex =
    draft && sectionKey !== DEPARTMENT_LEVEL
      ? draft.sections.findIndex((row) => row.name === sectionKey)
      : -1;

  const designations =
    draft == null
      ? []
      : sectionIndex >= 0
        ? draft.sections[sectionIndex]?.designations || []
        : draft.designations;

  const selectedDesignation =
    designations.find((row) => row.id === designationId) || null;

  function chooseSection(name: string, source: JdCatalogSnapshot | null = draft) {
    if (!source) return;
    setSectionKey(name);
    setRenameSection(name === DEPARTMENT_LEVEL ? "" : name);
    const rows =
      name === DEPARTMENT_LEVEL
        ? source.designations
        : source.sections.find((row) => row.name === name)?.designations || [];
    const first = rows[0];
    setDesignationId(first?.id || "");
    setRenameDesignation(first?.designation || "");
  }

  function chooseDesignation(id: string) {
    setDesignationId(id);
    setRenameDesignation(designations.find((row) => row.id === id)?.designation || "");
  }

  function addSection() {
    if (!draft) return;
    const name = sectionDraft.trim();
    if (!name) {
      toast.error("Enter a sub department");
      return;
    }
    if (draft.sections.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      toast.error("That sub department is already in the list");
      chooseSection(draft.sections.find((row) => row.name.toLowerCase() === name.toLowerCase())!.name);
      setSectionDraft("");
      return;
    }
    mark({ ...draft, sections: [...draft.sections, { name, designations: [] }] });
    setSectionDraft("");
    setSectionKey(name);
    setRenameSection(name);
    setDesignationId("");
    setRenameDesignation("");
  }

  function applySectionRename() {
    if (!draft || sectionIndex < 0) return;
    const name = renameSection.trim();
    if (!name) {
      toast.error("Sub department name is required");
      return;
    }
    if (
      draft.sections.some(
        (row, index) => index !== sectionIndex && row.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error("That sub department is already in the list");
      return;
    }
    const sections = draft.sections.map((section, index) =>
      index === sectionIndex ? { ...section, name } : section
    );
    mark({ ...draft, sections });
    setSectionKey(name);
  }

  function removeSection() {
    if (!draft || sectionIndex < 0) return;
    const name = draft.sections[sectionIndex]?.name;
    if (!name || !window.confirm(`Remove sub department “${name}” and its designations?`)) return;
    const sections = draft.sections.filter((_, index) => index !== sectionIndex);
    const next = { ...draft, sections };
    mark(next);
    chooseSection(sections[0]?.name || DEPARTMENT_LEVEL, next);
  }

  function addDesignation() {
    if (!draft) return;
    if (draft.sections.length > 0 && sectionIndex < 0) {
      toast.error("Select a sub department first");
      return;
    }
    const name = designationDraft.trim();
    if (!name) {
      toast.error("Enter a designation");
      return;
    }
    if (designations.some((row) => row.designation.toLowerCase() === name.toLowerCase())) {
      toast.error("That designation is already in this list");
      return;
    }
    const created = {
      id: newId("desig"),
      designation: name,
      groups: [
        {
          code: "1",
          title: sectionIndex >= 0 ? draft.sections[sectionIndex]!.name : "Responsibilities",
          lines: [],
        },
      ],
    };
    updateDesignations([...designations, created]);
    setDesignationDraft("");
    setDesignationId(created.id);
    setRenameDesignation(name);
  }

  function applyDesignationRename() {
    if (!selectedDesignation) return;
    const name = renameDesignation.trim();
    if (!name) {
      toast.error("Designation name is required");
      return;
    }
    if (
      designations.some(
        (row) =>
          row.id !== selectedDesignation.id && row.designation.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error("That designation is already in this list");
      return;
    }
    updateDesignations(
      designations.map((row) =>
        row.id === selectedDesignation.id ? { ...row, designation: name } : row
      )
    );
  }

  function removeDesignation() {
    if (!selectedDesignation) return;
    if (!window.confirm(`Remove designation “${selectedDesignation.designation}”?`)) return;
    const next = designations.filter((row) => row.id !== selectedDesignation.id);
    updateDesignations(next);
    setDesignationId(next[0]?.id || "");
    setRenameDesignation(next[0]?.designation || "");
  }

  function updateSelectedDesignation(
    patch: (row: NonNullable<typeof selectedDesignation>) => NonNullable<typeof selectedDesignation>
  ) {
    const id = designationId;
    if (!id) return;
    updateDesignations((rows) => rows.map((row) => (row.id === id ? patch(row) : row)));
  }

  function addGroup() {
    updateSelectedDesignation((row) => ({
      ...row,
      groups: [
        ...row.groups,
        {
          code: String(row.groups.length + 1),
          title: "Responsibilities",
          lines: [],
        },
      ],
    }));
  }

  function addLine(groupIndex: number) {
    updateSelectedDesignation((row) => ({
      ...row,
      groups: row.groups.map((group, index) => {
        if (index !== groupIndex) return group;
        const lineNumber = group.lines.length + 1;
        return {
          ...group,
          lines: [
            ...group.lines,
            {
              id: newId("line"),
              code: group.lines.some((line) => line.code) ? `${group.code}.${lineNumber}` : "",
              text: "",
            },
          ],
        };
      }),
    }));
  }

  async function handleSave() {
    if (!draft || !selectedDepartment || !profile) return;
    setBusy(true);
    try {
      const saved = await saveJdMaster({
        departmentId: selectedDepartment.id,
        sections: draft.sections,
        designations: draft.designations,
        updatedBy: profile.uid,
      });
      setMasters((current) => [
        ...current.filter((row) => row.departmentId !== saved.departmentId),
        saved,
      ]);
      setDraft(cloneDraft({ sections: saved.sections, designations: saved.designations }));
      setUsingSaved(true);
      setDirty(false);
      toast.success("Saved. These lists show the next time a Job Description is created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!selectedDepartment) return;
    if (
      !window.confirm(
        "Remove your saved lists for this department and go back to the original ones?"
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteJdMaster(selectedDepartment.id);
      setMasters((current) =>
        current.filter((row) => row.departmentId !== selectedDepartment.id)
      );
      const next = builtinCatalogSnapshot(selectedDepartment);
      setDraft(cloneDraft(next));
      setUsingSaved(false);
      setDirty(false);
      toast.success("Original lists restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission permission="jd:read">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">JD lists</h1>
            <p className="text-muted-foreground">
              Add or edit sub departments, designations, and job description lines. After you
              save, they appear the next time a Job Description is created.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/jd">Back to Job Descriptions</Link>
          </Button>
        </div>

        {!isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin only</CardTitle>
              <CardDescription>
                Only Admin can change these lists. Department Heads still see them when creating
                a Job Description.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Department</CardTitle>
              <CardDescription>
                Lists already added in the system are shown here. Edit them, then save. New
                sub departments and designations are added the same way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {departmentsLoading || loadingMasters ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading lists…
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={departmentId || undefined}
                    onValueChange={loadDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDepartments.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft && selectedDepartment && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {usingSaved
                        ? "Showing your saved lists for this department."
                        : "Showing the original lists. Save after you edit so everyone uses this version."}
                      {dirty ? " Unsaved changes." : ""}
                    </p>
                    <div className="flex gap-2">
                      {usingSaved && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleRestore()}
                        >
                          Restore original
                        </Button>
                      )}
                      <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Sub department</Label>
                    <Select value={sectionKey} onValueChange={chooseSection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DEPARTMENT_LEVEL}>
                          No sub department (department level)
                        </SelectItem>
                        {draft.sections.map((section) => (
                          <SelectItem key={section.name} value={section.name}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sectionIndex >= 0 && (
                      <div className="flex gap-2">
                        <Input
                          value={renameSection}
                          onChange={(event) => setRenameSection(event.target.value)}
                          placeholder="Sub department name"
                        />
                        <Button type="button" variant="secondary" onClick={applySectionRename}>
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeSection}
                          aria-label="Remove sub department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={sectionDraft}
                        onChange={(event) => setSectionDraft(event.target.value)}
                        placeholder="Add sub department"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addSection();
                          }
                        }}
                      />
                      <Button type="button" variant="secondary" onClick={addSection}>
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Designation</Label>
                    {designations.length > 0 ? (
                      <Select
                        value={designationId || undefined}
                        onValueChange={chooseDesignation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                        <SelectContent>
                          {designations.map((row) => (
                            <SelectItem key={row.id} value={row.id}>
                              {row.designation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No designations yet for this selection.
                      </p>
                    )}
                    {selectedDesignation && (
                      <div className="flex gap-2">
                        <Input
                          value={renameDesignation}
                          onChange={(event) => setRenameDesignation(event.target.value)}
                          placeholder="Designation"
                        />
                        <Button type="button" variant="secondary" onClick={applyDesignationRename}>
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeDesignation}
                          aria-label="Remove designation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={designationDraft}
                        onChange={(event) => setDesignationDraft(event.target.value)}
                        placeholder="Add designation"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addDesignation();
                          }
                        }}
                      />
                      <Button type="button" variant="secondary" onClick={addDesignation}>
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {selectedDesignation && (
                    <div className="space-y-4 rounded-md border p-3">
                      <div>
                        <Label>Job description</Label>
                        <p className="text-xs text-muted-foreground">
                          Lines for {selectedDesignation.designation}. These are the
                          responsibilities shown when this designation is selected on a Job
                          Description.
                        </p>
                      </div>
                      {selectedDesignation.groups.map((group, groupIndex) => (
                        <div key={`${selectedDesignation.id}-${groupIndex}`} className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              className="w-16"
                              value={group.code}
                              onChange={(event) => {
                                const code = event.target.value;
                                updateSelectedDesignation((row) => ({
                                  ...row,
                                  groups: row.groups.map((item, index) =>
                                    index === groupIndex ? { ...item, code } : item
                                  ),
                                }));
                              }}
                              aria-label="Group code"
                            />
                            <Input
                              value={group.title}
                              onChange={(event) => {
                                const title = event.target.value;
                                updateSelectedDesignation((row) => ({
                                  ...row,
                                  groups: row.groups.map((item, index) =>
                                    index === groupIndex ? { ...item, title } : item
                                  ),
                                }));
                              }}
                              aria-label="Group title"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                updateSelectedDesignation((row) => ({
                                  ...row,
                                  groups: row.groups.filter((_, index) => index !== groupIndex),
                                }));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {group.lines.map((line, lineIndex) => (
                            <div key={line.id} className="flex gap-2">
                              <Input
                                className="w-20"
                                value={line.code}
                                onChange={(event) => {
                                  const code = event.target.value;
                                  updateSelectedDesignation((row) => ({
                                    ...row,
                                    groups: row.groups.map((item, index) =>
                                      index === groupIndex
                                        ? {
                                            ...item,
                                            lines: item.lines.map((entry, entryIndex) =>
                                              entryIndex === lineIndex ? { ...entry, code } : entry
                                            ),
                                          }
                                        : item
                                    ),
                                  }));
                                }}
                                aria-label="Line code"
                              />
                              <Textarea
                                rows={2}
                                value={line.text}
                                onChange={(event) => {
                                  const text = event.target.value;
                                  updateSelectedDesignation((row) => ({
                                    ...row,
                                    groups: row.groups.map((item, index) =>
                                      index === groupIndex
                                        ? {
                                            ...item,
                                            lines: item.lines.map((entry, entryIndex) =>
                                              entryIndex === lineIndex ? { ...entry, text } : entry
                                            ),
                                          }
                                        : item
                                    ),
                                  }));
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  updateSelectedDesignation((row) => ({
                                    ...row,
                                    groups: row.groups.map((item, index) =>
                                      index === groupIndex
                                        ? {
                                            ...item,
                                            lines: item.lines.filter(
                                              (_, entryIndex) => entryIndex !== lineIndex
                                            ),
                                          }
                                        : item
                                    ),
                                  }));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addLine(groupIndex)}
                          >
                            Add line
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
                        Add group
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </RequirePermission>
  );
}
