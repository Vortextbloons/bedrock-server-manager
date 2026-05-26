import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { EventLogProvider } from '@/context/EventLogContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { Layout } from '@/components/Layout';
import { OverviewPage } from '@/pages/OverviewPage';
import { ServerPage } from '@/pages/ServerPage';
import { UpdatesPage } from '@/pages/UpdatesPage';
import { BackupsPage } from '@/pages/BackupsPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PacksPage } from '@/pages/PacksPage';
import { WorldsPage } from '@/pages/WorldsPage';
import { SystemPage } from '@/pages/SystemPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ServerActionsPage } from '@/pages/ServerActionsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2000 } },
});

function AppContent() {
  const { theme } = useTheme();
  return (
    <>
      <EventLogProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<OverviewPage />} />
              <Route path="server" element={<ServerPage />} />
              <Route path="updates" element={<UpdatesPage />} />
              <Route path="backups" element={<BackupsPage />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="packs" element={<PacksPage />} />
              <Route path="worlds" element={<WorldsPage />} />
              <Route path="system" element={<SystemPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="actions" element={<ServerActionsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme={theme} position="bottom-right" richColors />
      </EventLogProvider>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
