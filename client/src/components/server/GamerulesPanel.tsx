import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface GameruleValue {
  rule: string;
  currentValue: string;
  type: 'bool' | 'int';
  label: string;
  description?: string;
}

interface GamerulesResponse {
  gamerules: GameruleValue[];
  isOnline: boolean;
}

export function GamerulesPanel({ running }: { running: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [mutatingRule, setMutatingRule] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['server', 'gamerules'],
    queryFn: () => api.get<GamerulesResponse>('/server/gamerules'),
    enabled: running,
    refetchInterval: running ? 15000 : false,
  });

  const gamerules = data?.gamerules ?? [];
  const isOnline = data?.isOnline ?? false;

  const gameruleMutation = useMutation({
    mutationFn: ({ rule, value }: { rule: string; value: boolean | number }) =>
      api.put<{ currentValue?: string }>('/server/gamerules', { rule, value }),
    onSuccess: (data, { rule, value }) => {
      const nextValue =
        data?.currentValue ?? (typeof value === 'boolean' ? String(value) : String(value));
      queryClient.setQueryData<GamerulesResponse>(['server', 'gamerules'], (old) => {
        if (!old) return old;
        return {
          ...old,
          gamerules: old.gamerules.map((g) =>
            g.rule === rule ? { ...g, currentValue: nextValue } : g,
          ),
        };
      });
      setEditingValues((prev) => {
        const next = { ...prev };
        delete next[rule];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['server', 'gamerules'] });
      toast.success('Gamerule updated');
      setMutatingRule(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setMutatingRule(null);
      void queryClient.invalidateQueries({ queryKey: ['server', 'gamerules'] });
    },
  });

  const filtered = gamerules.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return g.rule.toLowerCase().includes(q) || g.label.toLowerCase().includes(q);
  });

  const editable = running && isOnline;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Gamerules</CardTitle>
            <CardDescription>
              {isOnline
                ? `${gamerules.length} gamerules loaded`
                : 'Server offline — values shown as "?"'}
            </CardDescription>
          </div>
          <Input
            placeholder="Search gamerules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading gamerules...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {search ? 'No gamerules match your search.' : 'No gamerules found.'}
          </p>
        ) : (
          <ScrollArea className="h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow key={g.rule}>
                    <TableCell>
                      <div className="font-medium">{g.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{g.rule}</div>
                      {g.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground/70">
                          {g.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.type === 'bool' ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={
                              isOnline ? String(g.currentValue).toLowerCase() === 'true' : false
                            }
                            disabled={!editable || gameruleMutation.isPending}
                            onCheckedChange={(checked) => {
                              setMutatingRule(g.rule);
                              gameruleMutation.mutate({ rule: g.rule, value: checked });
                            }}
                          />
                          <span className="text-sm">
                            {isOnline ? String(g.currentValue) : '?'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="h-8 w-28"
                            disabled={!editable || mutatingRule === g.rule}
                            value={
                              editingValues[g.rule] !== undefined
                                ? editingValues[g.rule]
                                : isOnline
                                  ? g.currentValue
                                  : ''
                            }
                            placeholder={isOnline ? '' : '?'}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [g.rule]: e.target.value,
                              }))
                            }
                          />
                          {isOnline && (
                            <span className="text-xs text-muted-foreground">
                              current: {g.currentValue}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.type === 'int' && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            !editable ||
                            mutatingRule === g.rule ||
                            (editingValues[g.rule] ?? g.currentValue) === g.currentValue
                          }
                          onClick={() => {
                            const raw = editingValues[g.rule] ?? g.currentValue;
                            const val = parseInt(raw, 10);
                            if (isNaN(val)) {
                              toast.error('Value must be a number');
                              return;
                            }
                            setMutatingRule(g.rule);
                            gameruleMutation.mutate({ rule: g.rule, value: val });
                          }}
                        >
                          {mutatingRule === g.rule ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
