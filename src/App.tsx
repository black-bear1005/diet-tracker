import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import MainApp from './pages/MainApp';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminFoods from './pages/Admin/Foods';
import AdminVersions from './pages/Admin/Versions';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          {/* Main App Route - wraps the existing logic */}
          <Route path="/app/*" element={<MainApp />} />
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/app" replace />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="foods" element={<AdminFoods />} />
            <Route path="versions" element={<AdminVersions />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;