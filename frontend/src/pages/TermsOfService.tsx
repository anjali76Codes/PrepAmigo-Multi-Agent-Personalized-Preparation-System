import { Link } from "react-router-dom";

const contactEmail = "anjaligupta92958@gmail.com";

export function TermsOfService() {
  return (
    <article className="mx-auto w-full max-w-4xl px-5 pb-20 pt-32 sm:px-8">
      <header className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-navy-500">
          PrepAmigo
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-carbon-900 sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-carbon-500">
          Effective date: October 7, 2026
        </p>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-carbon-700">
          These Terms of Service apply to your access to and use of PrepAmigo,
          a tool for researching interview opportunities and organizing
          personalized interview preparation. By using the service, you agree
          to these terms.
        </p>
      </header>

      <div className="space-y-9 rounded-card border border-border bg-surface/90 p-6 shadow-card sm:p-10">
        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Using PrepAmigo
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            You may use PrepAmigo to research companies and job roles, organize
            study plans, discover learning resources, and review your
            preparation progress. You are responsible for the information you
            submit, including ensuring that you have the right to provide any
            resume or other material you share.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Accounts and security
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            Keep your sign-in details secure and use only accounts that you are
            authorized to access. You are responsible for activity carried out
            through your account. Contact us promptly if you believe someone
            else has accessed it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Acceptable use
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            Do not misuse the service, interfere with its operation, attempt
            unauthorized access, submit unlawful or harmful material, or use
            PrepAmigo in a way that violates another person&apos;s rights or
            applicable law. We may limit or suspend access when reasonably
            necessary to protect the service, its users, or its providers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Preparation content and third-party services
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            Research, roadmaps, assessments, and learning suggestions are
            provided to help you prepare. They may be generated with AI or
            based on third-party search results, which can be incomplete,
            outdated, or inaccurate. PrepAmigo does not guarantee employment,
            interview results, or the accuracy or availability of third-party
            information. You are responsible for evaluating suggestions and
            checking important information with its original source.
          </p>
          <p className="mt-3 leading-7 text-carbon-700">
            Links to third-party websites and services are provided for
            convenience. Their content, availability, and practices are
            controlled by their respective providers and are not governed by
            these terms. Your use of those services may be subject to their own
            terms and policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Your content and privacy
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            You retain responsibility for content you submit. You authorize
            PrepAmigo to process that content as needed to provide the features
            you request. Our handling of personal information is described in
            the{" "}
            <Link
              className="font-medium text-navy-700 underline underline-offset-4"
              to="/privacy-policy"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Availability and changes
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            We work to keep PrepAmigo available, but features may change, be
            interrupted, or become unavailable. We may update these terms as
            the service changes. The effective date above indicates when the
            current version was published. Continued use after updated terms
            are published means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Disclaimer and limitation
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            To the extent permitted by law, PrepAmigo is provided on an
            &quot;as is&quot; and &quot;as available&quot; basis, without
            guarantees that the service will be uninterrupted, error-free, or
            suitable for a particular outcome. To the extent permitted by law,
            PrepAmigo is not liable for indirect or consequential loss arising
            from use of the service. Nothing in these terms limits a right or
            liability that cannot legally be limited.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-carbon-900">
            Contact
          </h2>
          <p className="mt-3 leading-7 text-carbon-700">
            Questions about these terms? Email{" "}
            <a
              className="font-medium text-navy-700 underline underline-offset-4"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            .
          </p>
        </section>

        <p className="border-t border-border pt-6 text-sm text-carbon-500">
          Read our <Link className="font-medium text-navy-700 underline underline-offset-4" to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </article>
  );
}
