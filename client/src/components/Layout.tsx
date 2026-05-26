import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Upload,
  Archive,
  Settings,
  FileText,
  Users,
  Package,
  Globe,
  Activity,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/server', label: 'Server', icon: Server },
  { to: '/updates', label: 'Updates', icon: Upload },
  { to: '/backups', label: 'Backups', icon: Archive },
  { to: '/worlds', label: 'Worlds', icon: Globe },
  { to: '/properties', label: 'Properties', icon: FileText },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/packs', label: 'Packs', icon: Package },
  { to: '/actions', label: 'Live Tools', icon: Zap },
  { to: '/system', label: 'System', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: () =>
      api.get<{
        port: number;
        serverCore: string;
        lanHosts: string[];
        minecraftAddresses: string[];
        minecraftPort: number;
      }>('/info'),
  });

  const lan = info?.lanHosts[0] ?? 'localhost';
  const mc = info?.minecraftAddresses[0] ?? `${lan}:${info?.minecraftPort ?? 19132}`;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50">
        <div className="border-b border-border p-4">
          <h1 className="text-sm font-bold tracking-wider text-primary">
            BDS<span className="text-accent">_</span>MANAGER
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">v1.0.0</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex justify-center">
            <ThemeToggle />
          </div>
          <Separator className="mb-2" />
          <p>Dashboard :{info?.port ?? (window.location.port || '8080')}</p>
          <p className="mt-1 truncate" title={info?.serverCore}>
            {info ? `LAN ${lan}:${info.port}` : 'Loading...'}
          </p>
          <p className="truncate">MC {mc}</p>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-auto">
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
