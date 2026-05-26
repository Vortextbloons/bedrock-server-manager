import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { EventLogProvider } from '@/context/EventLogContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { Layout } from '@/components/Layout';
import { OverviewPage } from '@/pages/OverviewPage';
import { ServerPage } from '@/pages/ServerPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { ConfigurationPage } from '@/pages/ConfigurationPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PacksPage } from '@/pages/PacksPage';
import { WorldsPage } from '@/pages/WorldsPage';
import { SettingsPage } from '@/pages/SettingsPage';

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
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="worlds" element={<WorldsPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="config" element={<ConfigurationPage />} />
              <Route path="packs" element={<PacksPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* Legacy routes */}
              <Route path="updates" element={<Navigate to="/maintenance" replace />} />
              <Route path="backups" element={<Navigate to="/maintenance" replace />} />
              <Route path="properties" element={<Navigate to="/config" replace />} />
              <Route path="system" element={<Navigate to="/server" replace />} />
              <Route path="actions" element={<Navigate to="/players" replace />} />
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
