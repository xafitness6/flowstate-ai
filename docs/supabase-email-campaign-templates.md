# Flowstate AI Supabase Email Templates

Use these in Supabase Dashboard -> Authentication -> Email Templates.

For production, set up custom SMTP in Supabase Dashboard -> Authentication -> Emails -> SMTP Settings. Without custom SMTP, emails can still show Supabase as the sender and can hit Supabase's built-in email rate limits.

Keep the Supabase variables exactly as written. For confirmation-style links, use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...&next=...` so Flowstate verifies the token server-side and avoids mobile callback failures.

## Shared Email Style

Use this structure for the main auth templates. It is table-based so it renders more reliably in Gmail, Apple Mail, Outlook, and mobile email clients.

Primary colors:

- Background: `#070707`
- Card: `#111111`
- Border: `#242424`
- Gold: `#B48B40`
- Text: `#F5F5F5`
- Muted text: `#9A9A9A`

## Confirm Sign Up

Subject:

```text
Confirm your Flowstate AI account
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:34px 30px 12px;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 30px 0;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;color:#F5F5F5;font-weight:700;">
                  Confirm your account
                </h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Your coach invited you to Flowstate AI. Confirm your email to finish setting up your account and continue onboarding.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 8px;">
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/auth/finish" style="display:inline-block;background:#B48B40;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;border-radius:12px;">
                  Confirm email
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 30px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#777777;">
                  This link keeps your account secure and connects your profile to the invite your coach sent.
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#666666;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#B48B40;word-break:break-all;">
                  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/auth/finish
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:#666666;">
            Flowstate AI
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Invite User

Subject:

```text
You're invited to Flowstate AI
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:34px 30px 12px;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 30px 0;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;color:#F5F5F5;font-weight:700;">
                  Your coach invited you
                </h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Set up your Flowstate account to access onboarding, training, nutrition, and coaching tools in one place.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 8px;">
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/finish" style="display:inline-block;background:#B48B40;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;border-radius:12px;">
                  Accept invite
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 30px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#777777;">
                  This secure link connects your account to your coach.
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#666666;">
                  If the button does not work, copy and paste this link:
                </p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#B48B40;word-break:break-all;">
                  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/finish
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:#666666;">
            Flowstate AI
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Magic Link

Subject:

```text
Your Flowstate AI sign-in link
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;">
            <tr>
              <td style="padding:34px 30px 30px;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
                <h1 style="margin:24px 0 0;font-size:28px;line-height:1.2;color:#F5F5F5;">
                  Sign in to Flowstate
                </h1>
                <p style="margin:14px 0 24px;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Use this secure link to sign in. It expires soon and can only be used once.
                </p>
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/auth/finish" style="display:inline-block;background:#B48B40;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;border-radius:12px;">
                  Sign in
                </a>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#666666;word-break:break-all;">
                  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/auth/finish
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Reset Password

Subject:

```text
Reset your Flowstate AI password
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;">
            <tr>
              <td style="padding:34px 30px 30px;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
                <h1 style="margin:24px 0 0;font-size:28px;line-height:1.2;color:#F5F5F5;">
                  Reset your password
                </h1>
                <p style="margin:14px 0 24px;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Use this secure link to create a new password for your Flowstate account.
                </p>
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="display:inline-block;background:#B48B40;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;border-radius:12px;">
                  Reset password
                </a>
                <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#777777;">
                  If you did not request this, you can ignore this email.
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#666666;word-break:break-all;">
                  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Change Email Address

Subject:

```text
Confirm your Flowstate AI email change
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;">
            <tr>
              <td style="padding:34px 30px 30px;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
                <h1 style="margin:24px 0 0;font-size:28px;line-height:1.2;color:#F5F5F5;">
                  Confirm your new email
                </h1>
                <p style="margin:14px 0 24px;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Confirm this change so your Flowstate account stays secure.
                </p>
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/profile" style="display:inline-block;background:#B48B40;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 24px;border-radius:12px;">
                  Confirm email change
                </a>
                <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#777777;">
                  If you did not request this change, ignore this email and keep using your current login.
                </p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#666666;word-break:break-all;">
                  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/profile
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Reauthentication

Subject:

```text
Your Flowstate AI security code
```

Body:

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #242424;border-radius:18px;">
            <tr>
              <td style="padding:34px 30px 30px;text-align:center;">
                <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#8D8D8D;">
                  <span style="color:#B48B40;">&#9889;</span> Flowstate AI
                </div>
                <h1 style="margin:24px 0 0;font-size:28px;line-height:1.2;color:#F5F5F5;">
                  Security check
                </h1>
                <p style="margin:14px 0 18px;font-size:16px;line-height:1.6;color:#A8A8A8;">
                  Enter this code to continue.
                </p>
                <div style="display:inline-block;letter-spacing:8px;font-size:34px;font-weight:700;color:#B48B40;background:#070707;border:1px solid #2E2E2E;border-radius:14px;padding:16px 20px;">
                  {{ .Token }}
                </div>
                <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#777777;">
                  If you did not request this, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Recommended Setup Steps

1. Open Supabase Dashboard.
2. Go to Authentication -> Emails -> Templates.
3. Open each template and paste the matching subject/body.
4. Save each template.
5. Go to SMTP Settings.
6. Set up custom SMTP before production. Use a sender like `Flowstate AI <support@yourdomain.com>`.
7. Send a test invite to yourself and verify the button returns to Flowstate.

## Notes

- The app currently uses `/auth/callback?next=/auth/finish` for invite signup confirmation redirects.
- The templates above use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...&next=...`. Do not replace `{{ .SiteURL }}` or `{{ .TokenHash }}` with hard-coded values.
- Supabase's default sender can still show `Supabase Auth <noreply@mail.app.supabase.io>` until custom SMTP is configured.
- If rate limits appear during testing, wait before retrying or delete the test user from Authentication -> Users and use a fresh test email.
