import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import MainScreen from './components/MainScreen';
import SettingsScreen from './components/SettingsScreen';
import './index.css';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/settings" replace />} />
          <Route path="/main" element={<MainScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
