"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CONTACT_STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import type { ContactWithCompany } from "@/types";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function ContactSheet({
  contactId,
  onClose,
}: {
  contactId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isNew = contactId === "new";

  const { data: contact } = useQuery<ContactWithCompany>({
    queryKey: ["contact", contactId],
    queryFn: () => fetch(`/api/contacts/${contactId}`).then((r) => r.json()),
    enabled: !!contactId && !isNew,
  });

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    companyName: "",
    status: "NOT_CONTACTED",
    priority: "MEDIUM",
    note: "",
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isNew) {
        return fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then((r) => r.json());
      }
      return fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(isNew ? "Contact created" : "Contact saved");
      onClose();
    },
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      fetch(`/api/contacts/${contactId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_note", body }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      setForm((f) => ({ ...f, note: "" }));
      toast.success("Note added");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/contacts/${contactId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact archived", {
        action: {
          label: "Undo",
          onClick: () =>
            fetch(`/api/contacts/${contactId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "restore" }),
            }),
        },
      });
      onClose();
    },
  });

  const scheduleFollowup = (when: "today" | "tomorrow" | "week") => {
    let date: Date;
    switch (when) {
      case "today":
        date = new Date();
        break;
      case "tomorrow":
        date = addDays(new Date(), 1);
        break;
      case "week":
        date = addWeeks(startOfWeek(new Date()), 1);
        break;
    }
    saveMutation.mutate({ nextFollowup: date.toISOString() });
  };

  const current = isNew ? form : {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    role: contact?.role ?? "",
    companyName: contact?.company?.name ?? "",
    status: contact?.status ?? "NOT_CONTACTED",
    priority: contact?.priority ?? "MEDIUM",
    note: "",
  };

  return (
    <Sheet open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isNew ? "New Contact" : contact?.name ?? contact?.email}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={isNew ? form.name : current.name}
              onChange={(e) => isNew ? setForm({ ...form, name: e.target.value }) : saveMutation.mutate({ name: e.target.value })}
              onBlur={(e) => !isNew && saveMutation.mutate({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              value={isNew ? form.email : current.email}
              onChange={(e) => isNew && setForm({ ...form, email: e.target.value })}
              onBlur={(e) => !isNew ? saveMutation.mutate({ email: e.target.value }) : undefined}
              disabled={!isNew}
            />
          </div>
          <div className="grid gap-2">
            <Label>Company</Label>
            <Input
              value={isNew ? form.companyName : current.companyName}
              onChange={(e) => isNew ? setForm({ ...form, companyName: e.target.value }) : saveMutation.mutate({ companyName: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Input
              value={isNew ? form.role : current.role}
              onChange={(e) => isNew ? setForm({ ...form, role: e.target.value }) : saveMutation.mutate({ role: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={isNew ? form.status : current.status}
                onValueChange={(v) => {
                  if (!v) return;
                  isNew ? setForm({ ...form, status: v }) : saveMutation.mutate({ status: v });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={isNew ? form.priority : current.priority}
                onValueChange={(v) => {
                  if (!v) return;
                  isNew ? setForm({ ...form, priority: v }) : saveMutation.mutate({ priority: v });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isNew ? (
            <Button className="w-full" onClick={() => saveMutation.mutate(form)}>
              Create Contact
            </Button>
          ) : (
            <>
              <Separator />
              <div>
                <Label className="mb-2 block">Follow-up</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => scheduleFollowup("today")}>Today</Button>
                  <Button variant="outline" size="sm" onClick={() => scheduleFollowup("tomorrow")}>Tomorrow</Button>
                  <Button variant="outline" size="sm" onClick={() => scheduleFollowup("week")}>This Week</Button>
                </div>
                {contact?.nextFollowup && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Scheduled: {format(new Date(contact.nextFollowup), "PPP")}
                  </p>
                )}
              </div>

              <Separator />
              <div>
                <Label className="mb-2 block">Notes</Label>
                <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                  {contact?.notes?.map((n) => (
                    <div key={n.id} className="rounded-md bg-muted p-2 text-sm">
                      <p>{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(n.createdAt), "PPp")}
                      </p>
                    </div>
                  ))}
                </div>
                <Textarea
                  placeholder="Add a note..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={!form.note.trim()}
                  onClick={() => noteMutation.mutate(form.note)}
                >
                  Add Note
                </Button>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full touch-target"
                onClick={() => setShowArchiveConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Archive Contact
              </Button>

              <ConfirmDialog
                open={showArchiveConfirm}
                onOpenChange={setShowArchiveConfirm}
                title="Archive this contact?"
                description="They'll be hidden from default views. Notes and outreach history are preserved."
                confirmLabel="Archive"
                variant="destructive"
                loading={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate()}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
