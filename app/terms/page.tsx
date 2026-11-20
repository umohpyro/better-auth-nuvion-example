export const metadata = { title: "Terms · better-auth-nuvion example" };

export default function Terms() {
  return (
    <main className="page narrow">
      <p className="eyebrow">Terms of use</p>
      <h1>Terms for using this demo</h1>
      <p className="lead">
        By creating an account or using this demo you agree to these terms. Last
        updated 20 November 2026.
      </p>

      <section className="card pad">
        <h3>What this is</h3>
        <p>
          A demonstration of the open-source <code>better-auth-nuvion</code>{" "}
          plugin, run by its maintainer, against Nuvion&apos;s test environment.
          It is not a financial service, it does not hold or move real money,
          and it is not an official Nuvion product.
        </p>
      </section>

      <section className="card pad">
        <h3>What you agree to</h3>
        <ul className="steps-text">
          <li>
            Use test credentials only: a test email, and a Nuvion{" "}
            <b>test-environment</b> API key. Do not enter real card, bank,
            identity or other sensitive details.
          </li>
          <li>
            You are responsible for the key you paste and for what is done with
            it in your own Nuvion account. Revoke it when you finish.
          </li>
          <li>
            Do not attack, overload or probe the service, try to reach other
            people&apos;s data, or use it for anything unlawful.
          </li>
          <li>
            You may delete your account and data at any time from Settings. See
            the <a href="/privacy">privacy notice</a>.
          </li>
        </ul>
      </section>

      <section className="card pad">
        <h3>No warranty</h3>
        <p>
          The demo is provided as is and as available. It can change, be reset
          or stop at any time, without notice, and data in it may be removed.
          The maintainer is not liable for loss or damage arising from its use,
          to the extent the law allows. Nothing here is financial, legal or
          compliance advice.
        </p>
      </section>

      <section className="card pad">
        <h3>The code</h3>
        <p>
          The source is MIT licensed in the{" "}
          <a href="https://github.com/umohpyro/better-auth-nuvion-example">
            repository
          </a>
          . These terms cover the hosted demo, not the code.
        </p>
      </section>

      <section className="card pad">
        <h3>Changes and contact</h3>
        <p>
          If these terms change, the date above changes and continued use means
          you accept them. Questions go in an issue on the repository, without
          personal details.
        </p>
      </section>
    </main>
  );
}
