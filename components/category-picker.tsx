"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ArrowRight, Check, ChevronsUpDown, Pencil, Plus } from "lucide-react";
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

type View =
  | { name: "picker" }
  | { name: "create" }
  | { name: "edit"; category: Doc<"categories"> };

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
  const [view, setView] = useState<View>({ name: "picker" });
  const [search, setSearch] = useState("");

  const selectedCategory = categories.find((c) => c._id === selected) ?? null;

  const backToPicker = () => setView({ name: "picker" });

  // Radix only fires onOpenChange for user-initiated closes, so every
  // programmatic close has to reset the view and search itself.
  function closeAndReset() {
    setOpen(false);
    setView({ name: "picker" });
    setSearch("");
  }

  async function createFromSearch() {
    const trimmed = search.trim();
    if (!trimmed) return;
    const id = await create({ name: trimmed, isPublic: true }).catch(() => null);
    if (id) {
      onSelect(id);
      closeAndReset();
    }
  }

  return (
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-64 justify-between"
        onClick={() => setOpen(true)}
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

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setView({ name: "picker" });
            setSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          {view.name === "picker" && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.categories.pick}</DialogTitle>
              </DialogHeader>
              <Command className="bg-transparent p-0">
                <CommandInput
                  autoFocus
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
                          closeAndReset();
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
                            setView({ name: "edit", category });
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator alwaysRender />
                  <CommandGroup forceMount>
                    <CommandItem forceMount onSelect={() => setView({ name: "create" })}>
                      <Plus />
                      {copy.categories.new}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </>
          )}

          {view.name === "create" && (
            <CreateView
              onBack={backToPicker}
              onCreated={(id) => {
                onSelect(id);
                closeAndReset();
              }}
            />
          )}

          {view.name === "edit" && (
            <EditView
              key={view.category._id}
              category={view.category}
              onBack={backToPicker}
              onDeleted={() => selected === view.category._id && onSelect(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <DialogHeader className="flex-row items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copy.categories.back}
        onClick={onBack}
      >
        <ArrowRight />
      </Button>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
  );
}

function CreateView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (id: Id<"categories">) => void;
}) {
  const create = useMutation(api.categories.create);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await create({ name: trimmed, isPublic }).catch(() => null);
    if (id) onCreated(id);
  }

  return (
    <>
      <BackHeader title={copy.categories.new} onBack={onBack} />
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
          <Button size="sm" variant="ghost" onClick={onBack}>
            {copy.categories.cancel}
          </Button>
        </div>
      </div>
    </>
  );
}

function EditView({
  category,
  onBack,
  onDeleted,
}: {
  category: Doc<"categories">;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const update = useMutation(api.categories.update);
  const remove = useMutation(api.categories.remove);
  const [name, setName] = useState(category.name);
  const [isPublic, setIsPublic] = useState(category.isPublic);

  return (
    <>
      <BackHeader title={copy.categories.editTitle} onBack={onBack} />
      <div className="flex flex-col gap-4">
        <Input
          autoFocus
          value={name}
          dir="auto"
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
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
              onBack();
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
              onBack();
            }}
          >
            {copy.categories.delete}
          </Button>
        </div>
      </div>
    </>
  );
}
