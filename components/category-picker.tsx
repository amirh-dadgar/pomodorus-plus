"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Check, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { copy, t } from "@/lib/copy";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CategoryPicker({
  selected,
  onSelect,
}: {
  selected: Id<"categories"> | null;
  onSelect: (id: Id<"categories"> | null) => void;
}) {
  const categories = useQuery(api.categories.list) ?? [];
  const create = useMutation(api.categories.create);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Doc<"categories"> | null>(null);

  const selectedCategory = categories.find((c) => c._id === selected) ?? null;

  function openCreate() {
    setOpen(false);
    setCreating(true);
  }

  async function createFromSearch() {
    const trimmed = search.trim();
    if (!trimmed) return;
    const id = await create({ name: trimmed, isPublic: true }).catch(() => null);
    if (id) {
      onSelect(id);
      setOpen(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-64 justify-between"
          >
            <span className="truncate">
              {selectedCategory ? (
                <>
                  {selectedCategory.name}
                  {!selectedCategory.isPublic && (
                    <span className="ms-1 text-xs opacity-60">
                      {copy.categories.privateBadge}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">{copy.categories.pick}</span>
              )}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput
              placeholder={copy.categories.search}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                <Button size="sm" variant="outline" onClick={createFromSearch}>
                  <Plus />
                  <span className="truncate">
                    {t(copy.categories.createNamed, { name: search.trim() })}
                  </span>
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {categories.map((category) => (
                  <CommandItem
                    key={category._id}
                    value={category.name}
                    onSelect={() => {
                      onSelect(category._id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={selected === category._id ? "opacity-100" : "opacity-0"}
                    />
                    <span className="flex-1 truncate">{category.name}</span>
                    {!category.isPublic && (
                      <span className="text-xs text-muted-foreground">
                        {copy.categories.privateBadge}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={t(copy.categories.editAria, { name: category.name })}
                      className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        setEditing(category);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={openCreate}>
                  <Plus />
                  {copy.categories.new}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateCategoryDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => onSelect(id)}
      />
      {editing && (
        <EditCategoryDialog
          category={editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onDeleted={() => selected === editing._id && onSelect(null)}
        />
      )}
    </div>
  );
}

function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"categories">) => void;
}) {
  const create = useMutation(api.categories.create);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await create({ name: trimmed, isPublic }).catch(() => null);
    if (id) {
      onCreated(id);
      setName("");
      setIsPublic(true);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{copy.categories.new}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
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
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              {copy.categories.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  onOpenChange,
  onDeleted,
}: {
  category: Doc<"categories">;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const update = useMutation(api.categories.update);
  const remove = useMutation(api.categories.remove);
  const [name, setName] = useState(category.name);
  const [isPublic, setIsPublic] = useState(category.isPublic);

  return (
    <Dialog open onOpenChange={onOpenChange}>
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
                onOpenChange(false);
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
                onOpenChange(false);
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
