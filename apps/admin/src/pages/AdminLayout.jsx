import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Store, Users } from 'lucide-react';
import { useAuth } from '@spoonate/portal/context/AuthContext';
const sections = [
  ['/admin', LayoutDashboard, 'Overview'],
  ['/admin/canteens', Store, 'Canteens'],
  ['/admin/orders', ClipboardList, 'All campus orders'],
  ['/admin/accounts', Users, 'Accounts & access'],
];
export default function AdminLayout() {
  const [params] = useSearchParams();
  const day = params.get('day');
  const destination = path => day && ['/admin', '/admin/canteens'].includes(path) ? `${path}?day=${encodeURIComponent(day)}` : path;
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await logout(); navigate('/login', { replace: true }); }
    catch { /* AuthProvider displays the error. */ }
  };
  return <div className="min-h-screen bg-[#f6f8f7]">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
      <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p>
      <p className="mt-2 text-sm text-white/60">Administration</p>
      <nav aria-label="Admin navigation" className="mt-10 space-y-3">{sections.map(([path, Icon, label]) => <NavLink key={path} to={destination(path)} end={path === '/admin'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 font-bold ${isActive ? 'bg-white text-[#075d50]' : 'hover:bg-white/10'}`}><Icon size={18} />{label}</NavLink>)}</nav>
      <button onClick={handleLogout} className="mt-auto flex items-center gap-3 px-4 py-3"><LogOut size={18} />Logout</button>
    </aside>
    <main className="lg:ml-64">
      <header className="border-b bg-white p-5 lg:px-10">
        <div className="flex items-center justify-between gap-4"><p className="flex items-center gap-2 text-sm font-bold text-[#0f8f73]"><ShieldCheck size={16} />CAMPUS ADMINISTRATION</p><button onClick={handleLogout} className="rounded-xl border px-4 py-2 lg:hidden">Logout</button></div>
        <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-4 text-sm font-bold lg:hidden">{sections.map(([path, , label]) => <NavLink key={path} to={destination(path)} end={path === '/admin'} className={({ isActive }) => isActive ? 'text-[#075d50] underline' : 'text-gray-500'}>{label}</NavLink>)}</nav>
      </header>
      <div className="mx-auto max-w-7xl space-y-7 p-5 lg:p-10"><Outlet /></div>
    </main>
  </div>;
}
