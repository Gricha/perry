import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type KV = { key: string; value: string };

export function KeyValueEditor({
  value,
  onChange,
  emptyLabel,
}: {
  value: Record<string, string> | undefined;
  onChange: (next: Record<string, string>) => void;
  emptyLabel?: string;
}) {
  const entries: KV[] = Object.entries(value || {}).map(([key, value]) => ({ key, value }));

  const setEntries = (next: KV[]) => {
    const out: Record<string, string> = {};
    for (const entry of next) {
      const key = entry.key.trim();
      if (!key) continue;
      out[key] = entry.value;
    }
    onChange(out);
  };

  const addRow = () => {
    setEntries([...entries, { key: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<KV>) => {
    const next = [...entries];
    next[index] = { ...next[index], ...patch };
    setEntries(next);
  };

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        {emptyLabel ? <div className="text-xs text-muted-foreground">{emptyLabel}</div> : null}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {entries.map((row, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <Input
              value={row.key}
              placeholder="key"
              className="font-mono sm:col-span-5"
              onChange={(e) => updateRow(index, { key: e.target.value })}
            />
            <Input
              value={row.value}
              placeholder="value"
              className="font-mono sm:col-span-6"
              onChange={(e) => updateRow(index, { value: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:col-span-1 justify-self-start"
              onClick={() => removeRow(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  );
}
