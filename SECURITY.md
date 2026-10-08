# Security policy

PrepAmigo handles user profiles, resumes, authentication tokens, and third-party provider credentials. Please report suspected vulnerabilities responsibly.

## Reporting a vulnerability

Do not open a public issue or pull request containing exploit instructions, credentials, personal data, or details that would help someone attack a deployed instance.

Use GitHub's **Report a vulnerability** option on the repository's **Security** tab to send a private report when it is available. If private vulnerability reporting is not enabled, contact the repository maintainers through a private channel before sharing technical details. Include the affected component, impact, reproduction steps, and a suggested mitigation when safe to do so.

Please allow maintainers a reasonable opportunity to investigate and prepare a fix before public disclosure. Do not access, alter, or retain other users' data while validating a report.

## Security practices for contributors

- Never commit `.env` files, API keys, passwords, JWT secrets, private certificates, or populated local fixtures.
- Use local environment files copied from the committed `.env.example` templates.
- Redact credentials, personal data, and private endpoints from issues, logs, and screenshots.
- Treat resumes, user content, and data returned by external search/model providers as sensitive.
- Do not weaken authentication or validation to make a test or local setup pass.
