# Security Policy

## Supported Versions

| Version | Supported                                           |
| ------- | --------------------------------------------------- |
| 0.x     | Yes -- security fixes applied to the latest release |

As this project is in active pre-1.0 development, security fixes are applied to the latest release only. There are no backport branches at this time.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly. Do not open a public GitHub issue.

**Email:** Send details to the maintainer via the email address listed on the [GitHub profile](https://github.com/jdmay2).

**Use this template in your report:**

- Subject: `[SECURITY] <short summary>`
- A description of the vulnerability
- Steps to reproduce or a proof of concept
- The affected package(s) and version(s)
- Any potential impact assessment
- Suggested remediation (if known)

**Please do not:**

- Publicly disclose the issue before a fix is available
- Open a regular issue or discussion with exploit details

**Maintainer process:**

1. Acknowledge receipt within 48 hours
2. Reproduce and triage severity
3. Coordinate fix and release
4. Publish a disclosure note after patch release

## Response Timeline

- **Acknowledgment** within 48 hours of receipt
- **Assessment and plan** within 7 days
- **Fix released** as soon as practical, depending on severity

## Scope

This policy covers the four published npm packages:

- `@peripherals/ble-core`
- `@peripherals/smart-home`
- `@peripherals/gesture-engine`
- `@peripherals/integration`

The example app (`apps/example`) is a development tool and is not covered by this policy.

## Disclosure

Once a fix is released, the vulnerability will be disclosed in the release notes. Credit will be given to the reporter unless they prefer to remain anonymous.
