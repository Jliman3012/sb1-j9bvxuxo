import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  LayoutDashboard,
  List,
  PieChart,
  Wallet,
  Settings,
  LogOut,
  Plus,
  Activity,
  Brain,
  Trophy,
  Play,
  Calendar,
  GraduationCap
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'All Trades', icon: List },
    { id: 'replay', label: 'Trade Replay', icon: Play },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'ai-coach', label: 'AI Coach', icon: Brain },
    { id: 'academy', label: 'Academy', icon: GraduationCap },
    { id: 'gamification', label: 'Progress', icon: Trophy },
    { id: 'backtesting', label: 'Backtesting', icon: Activity },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">TradeJournal</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {currentPage !== 'dashboard' && currentPage !== 'analytics' && currentPage !== 'backtesting' && !currentPage.includes('backtest') && !currentPage.includes('strategy') && (
            <div className="mb-6 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {navItems.find(item => item.id === currentPage)?.label}
              </h1>
              {currentPage === 'trades' && (
                <button
                  onClick={() => onNavigate('add-trade')}
                  className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Trade</span>
                </button>
              )}
              {currentPage === 'accounts' && (
                <button
                  onClick={() => onNavigate('add-account')}
                  className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Account</span>
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
