export const metadata = { title: "Privacy · better-auth-nuvion example" };

export default function Privacy() {
  return (
    <main className="page narrow">
      <p className="eyebrow">Privacy</p>
      <h1>What this demo keeps, and how to delete it</h1>
      <p className="lead">
        This is a demo application for the open-source{" "}
        <code>better-auth-nuvion</code> plugin, run by its maintainer. It is not
        a financial service and no real money moves. This notice says what it
        stores and who else touches that data. Last updated 20 November 2026.
      </p>

      <section className="card pad">
        <h3>What it stores</h3>
        <ul className="steps-text">
          <li>
            <b>Your account:</b> your email, a name taken from it, and your
            password, which is stored hashed. Better Auth also keeps your
            sessions, with the IP address and browser string they were created
            from.
          </li>
          <li>
            <b>What you build in the demo:</b> organizations and members, fee
            rules, the Nuvion entity and account ids you bind, payments and
            their legs (amounts, references, status), and event ids with
            timestamps.
          </li>
          <li>
            <b>Your Nuvion connection:</b> the API key you paste, the webhook
            signing secret and the entity and account ids. The key and secret
            are encrypted with AES-256-GCM on the server before they are stored,
            are never sent back to your browser, and are used only for your own
            requests and your own webhook events.
          </li>
          <li>
            <b>In your browser:</b> a session cookie, and your light or dark and
            accent choices in local storage. There are no analytics, advertising
            or tracking scripts.
          </li>
        </ul>
      </section>

      <section className="card pad">
        <h3>Who else is involved</h3>
        <ul className="steps-text">
          <li>
            <b>Vercel</b> hosts the app and keeps ordinary server logs.
          </li>
          <li>
            <b>Neon</b> hosts the database (Postgres, AWS us-east-1).
          </li>
          <li>
            <b>Nuvion</b> receives the requests this app makes with your key,
            against its test environment, and sends the webhooks you register.
            Nuvion&apos;s own terms and privacy notice apply to that.
          </li>
          <li>
            <b>Hookbox</b> is involved only if you paste an inbox address on the
            Settings page. The demo sends nothing to it itself; your Nuvion
            webhook then delivers events there.
          </li>
        </ul>
        <p>Nothing is sold or used for advertising.</p>
      </section>

      <section className="card pad">
        <h3>Keep it and delete it</h3>
        <ul className="steps-text">
          <li>
            Data is kept until you delete it. <b>Settings, Disconnect</b>{" "}
            removes your key and the webhooks the demo created in your Nuvion
            account.
          </li>
          <li>
            <b>Settings, Delete my account</b> removes everything above: the
            organizations you own with their payments and settings, your
            memberships, your connection, your sessions, your sign-in and your
            user. Payments you made as a customer of someone else&apos;s
            organization stay, without your id. Event ids, which contain no
            personal data, stay.
          </li>
          <li>
            Provider backups of the database may hold a copy for a short time
            after deletion.
          </li>
        </ul>
        <p>
          Please use a test email and test keys only. Do not enter real card,
          bank or identity details anywhere in this demo.
        </p>
      </section>

      <section className="card pad">
        <h3>Questions and changes</h3>
        <p>
          Open an issue on the{" "}
          <a href="https://github.com/umohpyro/better-auth-nuvion-example/issues">
            repository
          </a>{" "}
          and leave personal details out of it. If this notice changes, the date
          above changes. See also the <a href="/terms">terms of use</a>.
        </p>
      </section>
    </main>
  );
}
