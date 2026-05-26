import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Archive } from 'lucide-react';
import { UpdatePipelineSection } from '@/pages/UpdatesPage';
import { BackupsSection } from '@/pages/BackupsPage';

export function MaintenancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Maintenance</h2>
        <p className="text-sm text-muted-foreground">BDS updates and world backups</p>
      </div>

      <Tabs defaultValue="update">
        <TabsList>
          <TabsTrigger value="update" className="gap-2">
            <Upload className="h-4 w-4" /> Update
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <Archive className="h-4 w-4" /> Backups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="update" className="mt-4">
          <UpdatePipelineSection />
        </TabsContent>

        <TabsContent value="backups" className="mt-4">
          <BackupsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
