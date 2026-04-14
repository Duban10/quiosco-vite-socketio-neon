import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Mesero from './pages/Mesero';
import Cocina from './pages/Cocina';
import Header from './components/Header';
import { getStoredUser } from './utils/session';

const ProtectedRoute = ({ children, role }) => {
    const user = getStoredUser();
    if (!user) return <Navigate to="/" />;
    if (user.role !== role && role !== 'ANY') return <Navigate to="/" />;
    return children;
};

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute role="ADMIN"><Admin /></ProtectedRoute>} />
        <Route path="/mesero" element={<ProtectedRoute role="MESERO"><Mesero /></ProtectedRoute>} />
        <Route path="/cocina" element={<ProtectedRoute role="COCINA"><Cocina /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
