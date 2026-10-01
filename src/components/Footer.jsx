import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink/10 mt-16">
      <div className="max-w-5xl mx-auto px-5 py-6 flex flex-wrap gap-4 justify-between items-center text-sm text-ink-soft">
        <p>© {new Date().getFullYear()} Fandomly</p>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-sky">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-sky">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
