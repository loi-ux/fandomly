import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap a page with <ProtectedRoute roles={["organizer","admin"]}>...</ProtectedRoute>
// Omit `roles` to just require any logged-in user.
export default function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-ink-soft">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(role)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-6 text-center">
        <p className="font-display text-lg mb-2">Not available</p>
        <p className="text-ink-soft">
          This page is only for {roles.join(" or ")} accounts.
        </p>
      </div>
    );
  }

  return children;
}
