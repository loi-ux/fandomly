export default function TermsOfService() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-display text-3xl mb-2">Terms of Service</h1>
      <p className="text-ink-soft mb-8">Last updated: September 2026</p>

      <div className="space-y-6 leading-relaxed">
        <section>
          <h2 className="font-display text-xl mb-2">What Fandomly is</h2>
          <p>
            Fandomly is an online platform that lists fan-organized events
            in Cebu, Philippines, and connects fans (attendees) with event
            organizers. Fandomly is a discovery and coordination platform —
            we are not the organizer of any event listed on it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Accounts</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate information when signing up.</li>
            <li>You choose to sign up as a fan (attendee) or organizer. Organizer accounts require admin approval before they can publish events.</li>
            <li>You're responsible for keeping your account credentials secure.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">For organizers</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are solely responsible for the events you create, including their accuracy, safety, legality, and execution.</li>
            <li>Publishing a paid event requires a flat ₱100 listing fee, paid to Fandomly. This fee is non-refundable, including if you later cancel your event.</li>
            <li>Fandomly may grant free listing credits at its sole discretion.</li>
            <li>
              Payments from attendees for paid events happen directly
              between you and the attendee (GCash, bank transfer, or QR
              code), entirely outside Fandomly. Fandomly is not a party to
              these transactions, does not process, hold, or guarantee
              these payments, and is not responsible for resolving payment
              disputes, refunds, or non-payment between you and attendees.
            </li>
            <li>If you cancel an event, you are responsible for communicating and handling any refunds owed to attendees directly.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">For attendees</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Signing up for an event does not guarantee a spot if the event has a capacity limit — you may be placed on a waitlist.</li>
            <li>For paid events, your spot is only confirmed once the organizer manually confirms receipt of your payment. Fandomly does not verify or guarantee that organizers accurately confirm payments.</li>
            <li>You are responsible for making payments directly and safely to organizers and for keeping proof of payment.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Prohibited conduct</h2>
          <p>You may not use Fandomly to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Post fraudulent, fake, or misleading events</li>
            <li>Collect payment for an event you don't intend to hold</li>
            <li>Harass, threaten, or harm other users</li>
            <li>Violate any applicable law</li>
          </ul>
          <p className="mt-2">
            Fandomly may remove any event or account that violates these
            terms, at its discretion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Limitation of liability</h2>
          <p>
            Fandomly provides the platform "as is." To the fullest extent
            permitted by law, Fandomly is not liable for:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Disputes, losses, or damages arising from transactions between attendees and organizers</li>
            <li>The cancellation, quality, or safety of any event listed</li>
            <li>Any indirect, incidental, or consequential damages arising from your use of the platform</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these terms,
            at our discretion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Governing law</h2>
          <p>These terms are governed by the laws of the Republic of the Philippines.</p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Changes to these terms</h2>
          <p>
            We may update these terms as Fandomly grows. Continued use of
            the platform after changes means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Contact</h2>
          <p>
            Questions? Reach out to{" "}
            <a href="mailto:hello@fandomly.site" className="text-coral">hello@fandomly.site</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
