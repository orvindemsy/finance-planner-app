"use client";

import { useState } from "react";
import { TD } from "@/lib/table-styles";

const EDIT_INPUT = "border rounded px-1 py-0.5 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm w-full";

type SelectOption = { value: string; label: string };

type EditorKind =
  | { kind: "text" }
  | { kind: "number"; min?: number }
  | { kind: "date" }
  | { kind: "select"; options: SelectOption[] };

export function EditableCell({
  value,
  displayValue,
  editor,
  onSave,
  className,
}: {
  value: string;
  displayValue: React.ReactNode;
  editor: EditorKind;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit(newValue: string) {
    if (newValue === value) {
      setEditing(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  const cellClassName = `${className ?? TD} cursor-pointer`;

  if (!editing) {
    return (
      <td className={cellClassName} onClick={() => setEditing(true)} title="Click to edit">
        {displayValue}
        {error && <div className="text-xs text-red-500">{error}</div>}
      </td>
    );
  }

  if (editor.kind === "select") {
    return (
      <td className={className ?? TD}>
        <select
          autoFocus
          defaultValue={value}
          disabled={pending}
          onBlur={(e) => commit(e.target.value)}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className={EDIT_INPUT}
        >
          {editor.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
    );
  }

  return (
    <td className={className ?? TD}>
      <input
        autoFocus
        type={editor.kind}
        defaultValue={value}
        step={editor.kind === "number" ? "0.01" : undefined}
        min={editor.kind === "number" ? editor.min : undefined}
        disabled={pending}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={EDIT_INPUT}
      />
    </td>
  );
}
