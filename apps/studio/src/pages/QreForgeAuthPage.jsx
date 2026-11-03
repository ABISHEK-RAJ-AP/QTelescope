import { Navigate } from 'react-router-dom';

/** Legacy AuthGate hook — auth lives on /login */
export default function QreForgeAuthPage() {
  return <Navigate to="/login" replace />;
}
