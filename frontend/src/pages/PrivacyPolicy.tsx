import { Link } from "react-router-dom";

const contactEmail = "anjaligupta92958@gmail.com";

export function PrivacyPolicy() {
  return (
    <article className="mx-auto w-full max-w-4xl px-5 pb-20 pt-32 sm:px-8">
      <header className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cocoa">
          PrepAmigo
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-carbon-900 sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-carbon-500">
          Effective date: October 7, 2026
        </p>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-carbon-700">
          This policy explains how PrepAmigo handles information when you use
          our personalized interview-preparation service. PrepAmigo helps you
          research companies and roles, identify skills to work on, build a
          preparation roadmap, find learning resources, and track your
          progress.
        </p>
      </header>

      <div className="space-y-9 rounded-card border border-border bg-surface/90 p-6 shadow-card sm:p-10">
        <section>
          <h2 className="text-xl font-semibold text-carbon-900">Information we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-carbon-700">
            <li>
              <strong>Account information:</strong> your name and email address
              when you create an account with email and password, or sign in
              with Google. When you use Google sign-in, we receive the basic
              account details needed to identify your account, not your Google
              password.
            </li>
            <li>
              <strong>Preparation profile:</strong> information you choose to
              provide, such as your target role, experience level, skills,
              GitHub link, and resume. If you provide a resume, its text may be
              used to personalize your preparation recommendations.
            </li>
            <li>
              <strong>Preparation and progress:</strong> the company and role
              you are preparing for, generated plans and learning materials,
              assessment answers and results, and progress information such as
              completed topics and streaks.
            </li>
            <li>
              <strong>Notes and preferences:</strong> notes, display
              preferences, and custom resources that you save in the app may
              be stored in your browser.
            </li>
            <li>
              <strong>Technical information:</strong> the service processes
              information needed to maintain account sessions and operate
              requests. Your signed-in session uses a cookie; the app does not
              receive your Google password.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            How we use information
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            We use information to create and secure your account, respond to
            your requests, analyze job and company information, tailor
            preparation roadmaps and learning resources, evaluate your
            progress, and maintain and improve the service. Information you
            provide is used for these purposes and to provide the features you
            choose to use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Search and AI service providers
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            To provide research and personalized preparation features, the
            service may send relevant search terms to search providers and
            relevant prompts or preparation information to the AI provider
            configured for the service. For example, a company-research request
            may include the company and role you entered. If resume-based
            personalization is used, relevant resume text may be processed by
            that AI provider. Providers process information under their own
            terms and privacy policies. The providers and processing locations
            can depend on the service configuration. Do not include information
            in a prompt or resume that you are not comfortable having processed
            to provide the requested feature.
          </p>
          <p className="mt-3 leading-7 text-carbon-700">
            If you choose Google sign-in, Google processes your sign-in in
            accordance with{" "}
            <a
              className="font-medium text-expresso underline underline-offset-4"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google&apos;s Privacy Policy
            </a>
            . PrepAmigo uses Google sign-in to verify your identity and
            associate your account with your email address.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            How information is stored and protected
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            Account, profile, plan, and progress information is stored by the
            service in its database. Some notes and preferences are stored in
            your browser and may be removed if you clear that browser&apos;s
            storage. We use safeguards such as protected sign-in sessions and
            access controls, but no online service can guarantee that
            information will be completely secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Sharing and retention
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            We do not sell your personal information. We share only the
            information needed to operate the feature you request with the
            relevant service providers described above, or where disclosure is
            required to comply with law or protect the service and its users.
            Account information and associated preparation data are retained
            while needed to provide the service. Retention by service providers,
            technical logs, and backups may follow their own retention
            schedules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Your choices and requests
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            You can choose what profile and preparation information to provide,
            and you can remove browser-stored notes and preferences by clearing
            the site&apos;s storage in your browser. To request access to,
            correction of, or deletion of account information, or to ask a
            privacy question, email{" "}
            <a
              className="font-medium text-expresso underline underline-offset-4"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            . We may need to verify your request before acting on it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Changes and contact
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            We may update this policy when the service or its practices change.
            The effective date above indicates when the current version was
            published. For questions about this policy or your information,
            contact{" "}
            <a
              className="font-medium text-expresso underline underline-offset-4"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            .
          </p>
        </section>

        <p className="border-t border-border pt-6 text-sm text-carbon-500">
          Read our <Link className="font-medium text-expresso underline underline-offset-4" to="/terms-of-service">Terms of Service</Link>.
        </p>
      </div>
    </article>
  );
}
