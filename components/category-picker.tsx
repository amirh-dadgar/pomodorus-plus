"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { copy, t } from "@/lib/copy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CategoryPicker({
  selected,
  onSelect,
}: {
  selected: Id<"categories"> | null;
  onSelect: (id: Id<"categories"> | null) => void;
}) {
  const categories = useQuery(api.categories.list) ?? [];
  const create = useMutation(api.categories.create);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await create({ name: trimmed, isPublic }).catch(() => null);
    if (id) {
      onSelect(id);
      setName("");
      setAdding(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <span key={category._id} className="inline-flex items-center">
            <Button
              variant={selected === category._id ? "default" : "outline"}
              size="sm"
              className="rounded-e-none"
              onClick={() => onSelect(category._id)}
            >
              {category.name}
              {!category.isPublic && (
                <span className="ms-1 text-xs opacity-60">{copy.categories.privateBadge}</span>
              )}
            </Button>
            <EditCategory
              category={category}
              onDeleted={() => selected === category._id && onSelect(null)}
            />
          </span>
        ))}
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            {copy.categories.new}
          </Button>
        )}
      </div>
      {adding && (
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-md border p-3">
          <Input
            autoFocus
            placeholder={copy.categories.namePlaceholder}
            value={name}
            dir="auto"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex items-center justify-between">
            <Label htmlFor="new-public" className="text-sm text-muted-foreground">
              {copy.categories.publicLabel}
            </Label>
            <Switch id="new-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!name.trim()}>
              {copy.categories.add}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {copy.categories.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditCategory({
  category,
  onDeleted,
}: {
  category: Doc<"categories">;
  onDeleted: () => void;
}) {
  const update = useMutation(api.categories.update);
  const remove = useMutation(api.categories.remove);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [isPublic, setIsPublic] = useState(category.isPublic);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(category.name);
          setIsPublic(category.isPublic);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-s-none border-s-0 px-2" aria-label={t(copy.categories.editAria, { name: category.name })}>
          ⋯
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{copy.categories.editTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input value={name} dir="auto" maxLength={40} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center justify-between">
            <Label htmlFor={`public-${category._id}`} className="text-sm text-muted-foreground">
              {copy.categories.publicLabel}
            </Label>
            <Switch id={`public-${category._id}`} checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              disabled={!name.trim()}
              onClick={async () => {
                await update({ id: category._id, name: name.trim(), isPublic }).catch(() => {});
                setOpen(false);
              }}
            >
              {copy.categories.save}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={async () => {
                await remove({ id: category._id }).catch(() => {});
                onDeleted();
                setOpen(false);
              }}
            >
              {copy.categories.delete}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
