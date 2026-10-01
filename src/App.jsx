import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";

// Everything except Landing loads on demand, so a first-time visitor's
// initial download stays small — the rest streams in only as needed.
const SignUp = lazy(() => import("./pages/SignUp"));
const Login = lazy(() => import("./pages/Login"));
const BrowseEvents = lazy(() => import("./pages/BrowseEvents"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const AttendeeDashboard = lazy(() => import("./pages/AttendeeDashboard"));
const OrganizerDashboard = lazy(() => import("./pages/OrganizerDashboard"));
const OrganizerEventEditor = lazy(() => import("./pages/OrganizerEventEditor"));
const OrganizerEventAttendees = lazy(() => import("./pages/OrganizerEventAttendees"));
const OrganizerProfile = lazy(() => import("./pages/OrganizerProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CheckIn = lazy(() => import("./pages/CheckIn"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

function PageFallback() {
  return <p className="text-center py-16 text-ink-soft">Loading…</p>;
}

export default function App() {
  return (
    <div className="min-h-screen font-body">
      <Navbar />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/events" element={<BrowseEvents />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/organizers/:id" element={<OrganizerProfile />} />

          <Route
            path="/attendee"
            element={
              <ProtectedRoute roles={["attendee", "organizer", "admin"]}>
                <AttendeeDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer"
            element={
              <ProtectedRoute roles={["organizer", "admin"]}>
                <OrganizerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/new"
            element={
              <ProtectedRoute roles={["organizer", "admin"]}>
                <OrganizerEventEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/edit/:id"
            element={
              <ProtectedRoute roles={["organizer", "admin"]}>
                <OrganizerEventEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer/attendees/:eventId"
            element={
              <ProtectedRoute roles={["organizer", "admin"]}>
                <OrganizerEventAttendees />
              </ProtectedRoute>
            }
          />

          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      <Footer />
    </div>
  );
}
