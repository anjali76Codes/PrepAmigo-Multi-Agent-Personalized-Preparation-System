# Email Notifications Setup

PrepAmigo sends each user a **morning digest** listing that day's study tasks. Once the email is delivered, a matching `daily-digest` entry appears on the Notifications dashboard. Email goes out over SMTP through Nodemailer, so any SMTP provider works.

Email stays **off until `SMTP_HOST` is set**. The backend starts and runs normally without it and logs one warning: `SMTP_HOST is not set; outbound email is disabled`.

## 1. Settings

All of these go in `backend/.env`. Restart the backend after changing them.

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `SMTP_HOST` | *(blank, so email is off)* | SMTP server hostname |
| `SMTP_PORT` | `587` | `587` (STARTTLS) for most providers; `465` needs `SMTP_SECURE=true` |
| `SMTP_SECURE` | `false` | `true` only for port 465 (implicit TLS) |
| `SMTP_USER` | *(blank)* | SMTP username; leave blank for servers without auth (Mailpit) |
| `SMTP_PASS` | *(blank)* | SMTP password or API key |
| `MAIL_FROM` | `PrepAmigo <no-reply@prepamigo.app>` | Sender shown to users; must be an address the provider lets you send from |
| `ENABLE_DAILY_DIGEST` | `true` | `false` turns the digest job off entirely |
| `DAILY_DIGEST_HOUR` | `7` | Local hour (0-23) the digest goes out |

Never commit real credentials. `backend/.env.example` stays blank.

## 2. Choose a provider

| Use | Provider | Free tier | Effort |
| :--- | :--- | :--- | :--- |
| Local development | Mailpit (Docker) | Unlimited; emails are only caught locally, never delivered | 1 command |
| Personal testing | Gmail app password | About 500 emails a day | 2 minutes |
| Production | Brevo | 300 emails a day | Sign-up plus sender verification |
| Production | Resend | 3,000 emails a month | Sign-up plus domain verification |

### Option A: Mailpit (local, nothing actually sent)

Mailpit catches every email and shows it in a web inbox, which makes it the safest way to develop against the feature.

```bash
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

Open http://localhost:8025 to read the emails.

### Option B: Gmail app password (real delivery, quick)

1. Turn on **2-Step Verification** at https://myaccount.google.com/security. App passwords require it.
2. Open https://myaccount.google.com/apppasswords, create one named `PrepAmigo`, and copy the 16-character password. Google shows it once.
3. Add to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop   # the app password, without spaces
MAIL_FROM=PrepAmigo <you@gmail.com>
```

Notes:
- Use the app password, not your Google account password; Gmail rejects the account password over SMTP.
- Gmail rewrites the sender to your Gmail address, so keep `MAIL_FROM` the same as `SMTP_USER`.
- Gmail allows about 500 emails a day, which is fine for testing but not for production.

### Option C: Brevo (production)

1. Sign up at https://www.brevo.com.
2. Go to **Settings → SMTP & API → SMTP** and generate an SMTP key.
3. Under **Senders, Domains & Dedicated IPs**, verify the address (or domain) you will send from.

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your Brevo login, shown on the SMTP page>
SMTP_PASS=<SMTP key>
MAIL_FROM=PrepAmigo <no-reply@yourdomain.com>
```

### Option D: Resend (production)

1. Sign up at https://resend.com and verify your domain under **Domains** by adding the DNS records it shows.
2. Create an API key under **API Keys**.

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=<API key, starts with re_>
MAIL_FROM=PrepAmigo <no-reply@yourdomain.com>
```

On a deployed backend (Render), add the same variables in the service's **Environment** settings instead of a `.env` file.

## 3. How the digest works

- A cron job (`backend/src/jobs/dailyDigest.ts`) runs at 5 minutes past every hour.
- Each run looks at every user with `profile.daily_digest_email` not set to `false`. If it is currently `DAILY_DIGEST_HOUR` in that user's `profile.timezone` (an IANA name such as `Asia/Kolkata`; the server's timezone if unset), the user gets a digest.
- "Today's tasks" are the sprint days scheduled for the user's local date across their active plans, excluding completed days. A user with no tasks today gets no email.
- The `daily-digest` notification is created only after the email is delivered. A user who already received a digest in the last 20 hours is skipped, so restarts or re-runs never send twice.

Code: `backend/src/services/mailer.ts` (SMTP), `backend/src/services/dailyDigest.ts` (selection and email), `backend/src/services/notifications.ts` (notification records).

## 4. Check that it works

1. Start the backend and look for `Daily digest job scheduled (local hour 7, checked hourly).` in the log.
2. Send a digest immediately with `POST /api/notifications/test-digest`. See [EMAIL_TESTING.md](EMAIL_TESTING.md).
3. Check that the email arrived (in the Mailpit inbox, if you used Option A), and that the Notifications page shows a `daily-digest` entry.

## 5. Troubleshooting

| Symptom | Likely cause |
| :--- | :--- |
| Log says `SMTP_HOST is not set` | `SMTP_HOST` is blank, or the backend wasn't restarted after editing `.env` |
| `Failed to send email` with `Invalid login` / `535` | Wrong `SMTP_USER`/`SMTP_PASS`; for Gmail, an account password was used instead of an app password |
| `Failed to send email` with a TLS/`wrong version number` error | Port and `SMTP_SECURE` mismatch: 587 needs `false`, 465 needs `true` |
| Email sent but no notification | Not possible by design; check the backend log for an error after the send |
| No email and no error | No tasks scheduled for the user today, the current hour isn't the user's `DAILY_DIGEST_HOUR`, the user opted out (`profile.daily_digest_email: false`), or a digest already went out in the last 20 hours |
| Emails land in spam | Gmail/unverified senders; use Brevo or Resend with a verified domain |
