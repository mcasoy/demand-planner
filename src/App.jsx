import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase/config';
import PerformanceTool from './pages/PerformanceTool';

// Importa las páginas
import AuthScreen from './pages/AuthScreen';
import IndexPage from './pages/IndexPage';
import ForecastTool from './pages/ForecastTool';
import PurchaseOrderTool from './pages/PurchaseOrderTool';
import PlaceholderTool from './components/PlaceholderTool';


const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }
  return user ? children : <Navigate to="/auth" />;
};

const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { user, loading };
}

const App = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.signOut().then(() => {
      navigate('/auth');
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando Autenticación...</div>;
  }

  return (
    <Routes>
      <Route path="/auth" element={!user ? <AuthScreen /> : <Navigate to="/" />} />
      <Route path="/" element={
          <ProtectedRoute>
            <IndexPage onLogout={handleLogout} />
          </ProtectedRoute>
      }/>
      <Route path="/forecast" element={
          <ProtectedRoute>
            <ForecastTool />
          </ProtectedRoute>
      }/>
      <Route path="/purchase-orders" element={
          <ProtectedRoute>
            <PurchaseOrderTool />
          </ProtectedRoute>
      }/>
      <Route path="/performance" element={
    <ProtectedRoute>
        <PerformanceTool />
    </ProtectedRoute>
}/>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;