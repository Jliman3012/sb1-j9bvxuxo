import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradesList from './components/TradesList';
import AddTrade from './components/AddTrade';
import Analytics from './components/Analytics';
import Accounts from './components/Accounts';
import AddAccount from './components/AddAccount';
import Settings from './components/Settings';
import Backtesting from './components/Backtesting';
import CreateStrategy from './components/CreateStrategy';
import RunBacktest from './components/RunBacktest';
import BacktestResults from './components/BacktestResults';
import AICoach from './components/AICoach';
import Gamification from './components/Gamification';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import GoalsTracker from './components/GoalsTracker';
import WeeklyReport from './components/WeeklyReport';
import TradeReplay from './components/TradeReplay';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState<any>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleNavigate = (page: string, data?: any) => {
    setCurrentPage(page);
    setPageData(data);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'trades':
        return <TradesList />;
      case 'add-trade':
        return <AddTrade onBack={() => setCurrentPage('trades')} />;
      case 'replay':
        return <TradeReplay onBack={() => setCurrentPage('trades')} />;
      case 'analytics':
        return (
          <div className="space-y-8">
            <AdvancedAnalytics />
            <WeeklyReport />
            <GoalsTracker />
          </div>
        );
      case 'ai-coach':
        return <AICoach />;
      case 'gamification':
        return (
          <div className="space-y-8">
            <Gamification />
            <GoalsTracker />
          </div>
        );
      case 'backtesting':
        return <Backtesting onNavigate={handleNavigate} />;
      case 'create-strategy':
        return <CreateStrategy onBack={() => setCurrentPage('backtesting')} />;
      case 'run-backtest':
        return <RunBacktest onBack={() => setCurrentPage('backtesting')} />;
      case 'backtest-results':
        return <BacktestResults backtest={pageData} onBack={() => setCurrentPage('backtesting')} />;
      case 'accounts':
        return <Accounts onNavigate={setCurrentPage} />;
      case 'add-account':
        return <AddAccount onBack={() => setCurrentPage('accounts')} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
