# Testing Email & Notifications (Gmail SMTP)

Send yourself the morning digest **right now** and see it on the Notifications page, without waiting for `DAILY_DIGEST_HOUR`.

## 1. `backend/.env`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=<16-char Gmail app password, no spaces>
MAIL_FROM=PrepAmigo <you@gmail.com>
```

Restart the backend after editing. To get an app password, see [EMAIL_NOTIFICATIONS_SETUP.md](EMAIL_NOTIFICATIONS_SETUP.md#option-b-gmail-app-password-real-delivery-quick).

## 2. The test endpoint

```
POST /api/notifications/test-digest
Body (optional): { "to": "someone@example.com" }
```

- Sends today's tasks to the signed-in user immediately. With no tasks today, it sends a short **"PrepAmigo test email: no tasks today"** instead, so delivery can always be tested.
- When the email is delivered, it creates the matching `daily-digest` notification.
- It skips the digest hour and the once-a-day guard, so you can call it as often as you like.
- `to` overrides the recipient, **outside production only**.
- It is on by default outside production and off in production unless `ENABLE_TEST_NOTIFICATIONS=true`; in production the email always goes to the account's own address.

## 3. Trigger it

**Logged in through the frontend (your real account email):** open the app, press F12 to open the browser console, and run:

```js
await (await fetch("http://localhost:3000/api/notifications/test-digest", {
  method: "POST", credentials: "include",
})).json()
```

The browser sends your session cookie, so the email goes to your Google account's address.

**Local dev without login (`ENABLE_AUTH=false`):** requests run as a placeholder user (`local-development-user@localhost.invalid`) that can't receive mail, so pass `to`:

```bash
curl -X POST http://localhost:3000/api/notifications/test-digest \
  -H "Content-Type: application/json" \
  -d '{"to":"you@gmail.com"}'
```

## 4. Check the result

**Response:**

```json
{ "success": true, "data": { "delivered": true, "to": "you@gmail.com", "taskCount": 2, "notificationId": "..." } }
```

On failure you get HTTP `502` with `success: false` and `data.error` holding the SMTP server's reason (see section 5).

**Inbox:** the email arrives from `MAIL_FROM` within a few seconds. Check Spam the first time.

**Frontend:** open the **Notifications** page (it refreshes when opened). The new entry has the sun icon, the email's subject as its title, and a "Daily digest" filter. The bell's unread badge updates on the next page load.

## 5. Gmail errors

| `data.error` contains | Fix |
| :--- | :--- |
| `SMTP_HOST is not set` | `.env` not loaded: the variable is blank, or the backend wasn't restarted |
| `535` / `Username and Password not accepted` | Use an **app password**, not your Google password; 2-Step Verification must be on; remove the spaces from the 16 characters |
| `Connection timeout` (after about 10s) | Port 587 is blocked by your network/VPN/firewall; try another network, or `SMTP_PORT=465` with `SMTP_SECURE=true` |
| `wrong version number` / TLS error | Port and `SMTP_SECURE` mismatch: 587 needs `false`, 465 needs `true` |
| `ENOTFOUND` | Typo in `SMTP_HOST` (must be `smtp.gmail.com`) |
| HTTP `404 Not found.` | The endpoint is off: you're in production without `ENABLE_TEST_NOTIFICATIONS=true` |
| HTTP `400` about `to` | Invalid address, or `to` was sent in production |

The backend log also prints `Failed to send email` with the full SMTP error.
