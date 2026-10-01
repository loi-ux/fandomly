export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-12 prose-content">
      <h1 className="font-display text-3xl mb-2">Privacy Policy</h1>
      <p className="text-ink-soft mb-8">Last updated: September 2026</p>

      <div className="space-y-6 leading-relaxed">
        <p>
          Fandomly ("we," "us," "Fandomly") operates fandomly.site, a
          platform for discovering and organizing fandom events in Cebu,
          Philippines. This policy explains what information we collect,
          how we use it, and your rights, in line with the Philippine Data
          Privacy Act of 2012 (RA 10173).
        </p>

        <section>
          <h2 className="font-display text-xl mb-2">Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account info:</strong> display name, email address,
              city, and password (encrypted) when you sign up.
            </li>
            <li>
              <strong>Event info:</strong> if you're an organizer, the
              events you create, including any custom questions you set up
              and attendees' answers to them.
            </li>
            <li>
              <strong>Signup info:</strong> which events you've signed up
              for, your attendance status, and (for paid events) your
              payment confirmation status.
            </li>
            <li>
              <strong>Communications:</strong> emails we send you (event
              confirmations, reminders, cancellations) via our email
              provider, Resend.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">What we don't collect</h2>
          <p>
            Fandomly does not collect or process payment information.
            Payments for paid events happen directly between attendees and
            organizers via GCash, bank transfer, or QR code, entirely
            outside our platform. We only store organizers' payment
            instructions (e.g. a GCash number) as text they choose to
            display, and a manual confirmation of whether payment was
            received.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">How we use your information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate the platform — creating your account, showing you events, letting you sign up, sending you passes and reminders.</li>
            <li>To communicate — emails about events you've followed, signed up for, or that get cancelled.</li>
            <li>To improve Fandomly — aggregated, non-identifying attendance statistics visible to admins.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Third-party services</h2>
          <p>We use the following providers to operate Fandomly, each processing your data as our service provider:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> — database, authentication, and file storage</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Netlify</strong> — website hosting</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Your rights</h2>
          <p>Under the Data Privacy Act of 2012, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent (which may limit your ability to use Fandomly)</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{" "}
            <a href="mailto:hello@fandomly.site" className="text-coral">hello@fandomly.site</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Data retention</h2>
          <p>
            We retain your data for as long as your account is active. If
            you request account deletion, we'll remove your personal
            information within a reasonable time, except where we're
            required to retain records (e.g. financial records related to
            listing fees).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Children's privacy</h2>
          <p>
            Fandomly is not intended for children under 18. We do not
            knowingly collect data from minors.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Cookies & local storage</h2>
          <p>
            Fandomly is a Progressive Web App and uses local browser
            storage to keep you logged in and enable offline functionality.
            We do not use third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Changes to this policy</h2>
          <p>
            We may update this policy as Fandomly grows. We'll update the
            "last updated" date above when we do.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Contact</h2>
          <p>
            Questions about this policy? Reach out to{" "}
            <a href="mailto:hello@fandomly.site" className="text-coral">hello@fandomly.site</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
