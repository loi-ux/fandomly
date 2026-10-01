import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header className="border-b-2 border-ink/10 bg-paper sticky top-0 z-10">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <Link to="/" className="font-display text-xl tracking-tight">
          fandomly<span className="text-sky">.</span>
        </Link>

        <div className="flex items-center gap-5 text-sm font-medium">
          <Link to="/events" className="hover:text-sky">
            Browse events
          </Link>

          {user && (role === "organizer" || role === "admin") && (
            <Link to="/organizer" className="hover:text-sky">
              My events
            </Link>
          )}

          {user && role === "admin" && (
            <Link to="/admin" className="hover:text-sky">
              Admin
            </Link>
          )}

          {user && role === "attendee" && (
            <Link to="/attendee" className="hover:text-sky">
              My signups
            </Link>
          )}

          {!user && (
            <>
              <Link to="/login" className="hover:text-sky">
                Log in
              </Link>
              <Link
                to="/signup"
                className="bg-ink text-paper rounded-full px-4 py-2 hover:bg-sky transition-colors"
              >
                Sign up
              </Link>
            </>
          )}

          {user && (
            <button
              onClick={handleSignOut}
              className="text-ink-soft hover:text-sky"
            >
              Log out ({profile?.display_name ?? "…"})
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
