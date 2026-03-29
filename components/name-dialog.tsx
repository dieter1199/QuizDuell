"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { displayNameSchema } from "@/lib/validation";

type NameDialogProps = {
  open: boolean;
  title: string;
  description: string;
  initialName?: string;
  submitLabel?: string;
  onSave: (displayName: string) => void;
  onClose?: () => void;
};

export function NameDialog({
  open,
  title,
  description,
  initialName = "",
  submitLabel = "Save name",
  onSave,
  onClose,
}: NameDialogProps) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      <NameDialogForm
        key={`${open}-${initialName}`}
        initialName={initialName}
        submitLabel={submitLabel}
        onClose={onClose}
        onSave={onSave}
      />
    </Dialog>
  );
}

function NameDialogForm({
  initialName,
  submitLabel,
  onSave,
  onClose,
}: {
  initialName: string;
  submitLabel: string;
  onSave: (displayName: string) => void;
  onClose?: () => void;
}) {
  const [displayName, setDisplayName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = displayNameSchema.safeParse(displayName);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid display name.");
      return;
    }

    onSave(parsed.data);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm text-slate-200">
        <span className="mb-2 block">Display name</span>
        <Input
          autoFocus
          maxLength={24}
          placeholder="Quiz master"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <div className="flex justify-end gap-3">
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
