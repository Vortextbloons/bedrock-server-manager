import { FileText, Sliders, AlertTriangle } from 'lucide-react';
import { useServerStatus } from '@/hooks/useServerStatus';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PropertiesEditor } from '@/pages/PropertiesPage';
import { GamerulesPanel } from '@/components/server/GamerulesPanel';

export function ConfigurationPage() {
  const { data: status } = useServerStatus();
  const running = status?.running ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Server properties (offline) and gamerules (live)
        </p>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties" className="gap-2">
            <FileText className="h-4 w-4" /> Server Properties
          </TabsTrigger>
          <TabsTrigger value="gamerules" className="gap-2">
            <Sliders className="h-4 w-4" /> Gamerules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-4">
          <PropertiesEditor />
        </TabsContent>

        <TabsContent value="gamerules" className="mt-4 space-y-4">
          {!running && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Server must be running to view and edit gamerules.</p>
            </div>
          )}
          <GamerulesPanel running={running} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
