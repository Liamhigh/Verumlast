
import React, { useState, Suspense, lazy } from 'react';

const LandingPage = lazy(() => import('./components/LandingPage'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));

type View = 'landing' | 'chat';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('landing');

  const enterApplication = () => {
    setCurrentView('chat');
  };

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background-dark text-text-light">Loading Application...</div>}>
      {currentView === 'landing' ? (
        <LandingPage onEnter={enterApplication} />
      ) : (
        <ChatInterface />
      )}
    </Suspense>
  );
};

export default App;
