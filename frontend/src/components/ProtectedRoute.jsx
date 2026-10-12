import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function ProtectedRoute({ children }) {
  const { adminToken } = useApp();
  const location = useLocation();

  if (!adminToken) {
    // Redirect unauthenticated user to master login page, saving their target location
    return <Navigate to="/master/login" state={{ from: location }} replace />;
  }

  return children;
}
