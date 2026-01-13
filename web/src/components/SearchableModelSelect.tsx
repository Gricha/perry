import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ModelInfo } from '@/lib/api';

interface SearchableModelSelectProps {
  models: ModelInfo[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showProvider?: boolean;
}

export function SearchableModelSelect({
  models,
  value,
  onChange,
  placeholder = 'Select model...',
  showProvider = false,
}: SearchableModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      (m.provider && m.provider.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedModel = models.find((m) => m.id === value);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={selectedModel ? '' : 'text-muted-foreground'}>
          {selectedModel ? (
            showProvider && selectedModel.provider ? (
              <span>
                <span className="text-muted-foreground">{selectedModel.provider}/</span>
                {selectedModel.name}
              </span>
            ) : (
              selectedModel.name
            )
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 rounded-md border bg-popover shadow-lg"
            style={{
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 280),
            }}
          >
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="flex-1 bg-transparent py-2 px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredModels.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No models found</div>
              ) : (
                filteredModels.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${
                      value === model.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {showProvider && model.provider && (
                          <span className="text-muted-foreground font-normal">{model.provider}/</span>
                        )}
                        {model.name}
                      </div>
                      {model.description && (
                        <div className="text-xs text-muted-foreground truncate">{model.description}</div>
                      )}
                    </div>
                    {value === model.id && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
