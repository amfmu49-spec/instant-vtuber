import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import MainScreen from './components/MainScreen';
import SettingsScreen from './components/SettingsScreen';
import OpeningScreen from './components/OpeningScreen';
import './index.css';

function AppContent() {
  const [showOpening, setShowOpening] = useState(true);

  return (
    <>
      {showOpening ? (
        <OpeningScreen onFinish={() => setShowOpening(false)} />
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/settings" replace />} />
          <Route path="/main" element={<MainScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  );
}

export default App;
