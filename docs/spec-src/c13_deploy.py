from kit import *
from reportlab.platypus import PageBreak


def deploy():
    s = []
    s += H1("Deployment on AWS (S3, CloudFront, ECS)")
    s += H2("Environments")
    s += table([
        ["Environment", "URL pattern", "Purpose", "Deploys"],
        ["dev", "*.dev.medicore.app", "Developer integration", "Every merge to develop"],
        ["staging", "*.staging.medicore.app", "QA, UAT with client, demo", "Release branch"],
        ["production", "*.medicore.app + custom domains", "Live hospitals",
         "Tagged release, manual approval"],
    ], widths=[0.15, 0.3, 0.3, 0.25])

    s += H2("One-time AWS setup")
    s += numbered([
        "Create three AWS accounts (dev, staging, prod) under AWS Organizations; enable "
        "CloudTrail, GuardDuty and AWS Config in all.",
        "Register domain in Route 53. Request a wildcard ACM certificate for "
        "*.medicore.app in <b>us-east-1</b> (required by CloudFront) and one in ap-south-1 "
        "for the ALB.",
        "Apply Terraform in infra/ to create: VPC (2 public, 2 private subnets), S3 web "
        "buckets, S3 documents bucket with KMS key, CloudFront distributions with OAC, "
        "ALB, ECS cluster and services, ECR repositories, ElastiCache Redis, Secrets "
        "Manager entries, IAM roles, CloudWatch alarms, WAF.",
        "Create the MongoDB Atlas project in Mumbai, an M30 cluster, PrivateLink endpoint "
        "into the VPC, database user with least privilege, continuous backup on.",
        "Store secrets (Mongo URI, JWT keys, SMS and payment keys) in Secrets Manager; ECS "
        "injects them as environment variables at task start.",
        "Create a GitHub OIDC role per account so GitHub Actions deploys without long-lived "
        "AWS keys.",
    ])

    s += H2("React app on S3 and CloudFront")
    s += code("""
# Build
pnpm --filter web build                 # outputs apps/web/dist (index.html + hashed assets)

# Upload hashed assets with long cache, then index.html with no cache
aws s3 sync apps/web/dist s3://medicore-web-prod \\
  --delete --exclude index.html \\
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp apps/web/dist/index.html s3://medicore-web-prod/index.html \\
  --cache-control "no-cache,no-store,must-revalidate" --content-type text/html

# Only index.html needs invalidation because assets have content hashes
aws cloudfront create-invalidation --distribution-id E1ABCDEF2GHIJK --paths "/index.html"
""", "Manual deployment commands")
    s += code("""
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::medicore-web-prod/*",
    "Condition": { "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/E1ABCDEF2GHIJK" } }
  }]
}
""", "S3 bucket policy: only CloudFront can read (bucket stays private)")
    s += table([
        ["CloudFront setting", "Value"],
        ["Origins", "S3 web bucket (OAC); ALB (HTTPS only, custom header secret so ALB "
                    "rejects direct traffic)"],
        ["Default behaviour", "S3, CachingOptimized, redirect HTTP to HTTPS, compress"],
        ["/api/*", "ALB, CachingDisabled, origin request policy AllViewer (forwards Host "
                   "header for tenant resolution), all HTTP methods"],
        ["/socket.io/*", "ALB, CachingDisabled, WebSocket allowed"],
        ["Custom errors", "403 and 404 from S3 return /index.html with 200 so React "
                          "Router deep links work"],
        ["Security headers", "Response headers policy: HSTS, CSP, X-Frame-Options DENY, "
                             "Referrer-Policy"],
        ["Alternate names", "*.medicore.app plus each hospital's custom domain"],
        ["WAF", "AWS managed core rule set, SQLi, known bad inputs, IP rate limiting"],
    ], widths=[0.25, 0.75], first_col_bold=True)

    s += H2("API and worker containers")
    s += code("""
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api build && pnpm --filter api deploy --prod /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /out .
USER app
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/server.js"]        # worker task overrides with dist/worker.js
""", "apps/api/Dockerfile")

    s += H2("CI/CD with GitHub Actions")
    s += code("""
name: deploy-web
on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'packages/**']
permissions: { id-token: write, contents: read }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production                 # requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web lint && pnpm --filter web test -- --run
      - run: pnpm --filter web build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy-web
          aws-region: ap-south-1
      - run: |
          aws s3 sync apps/web/dist s3://${{ vars.WEB_BUCKET }} --delete \\
            --exclude index.html --cache-control "public,max-age=31536000,immutable"
          aws s3 cp apps/web/dist/index.html s3://${{ vars.WEB_BUCKET }}/index.html \\
            --cache-control "no-cache,no-store,must-revalidate"
          aws cloudfront create-invalidation \\
            --distribution-id ${{ vars.CF_DISTRIBUTION_ID }} --paths "/index.html"
""", ".github/workflows/deploy-web.yml")
    s += code("""
name: deploy-api
on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/**']
permissions: { id-token: write, contents: read }
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongo: { image: 'mongo:8', ports: ['27017:27017'], options: '--replSet rs0' }
      redis: { image: 'redis:7', ports: ['6379:6379'] }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker exec $(docker ps -qf ancestor=mongo:8) mongosh --eval 'rs.initiate()'
      - run: pnpm --filter api lint && pnpm --filter api typecheck
      - run: pnpm --filter api test -- --run
  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy-api
          aws-region: ap-south-1
      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2
      - run: |
          IMAGE=${{ steps.ecr.outputs.registry }}/medicore-api:${{ github.sha }}
          docker build -f apps/api/Dockerfile -t $IMAGE .
          docker push $IMAGE
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV
      - run: pnpm --filter api migrate:up      # idempotent index + data migrations
      - run: |
          for svc in api worker; do
            ./infra/scripts/ecs-deploy.sh medicore-prod medicore-$svc "$IMAGE"
          done                                  # rolling update, circuit breaker rollback
""", ".github/workflows/deploy-api.yml")

    s += H2("Environment variables")
    s += table([
        ["Variable", "Example / source", "Notes"],
        ["NODE_ENV", "production", ""],
        ["MONGO_URI", "Secrets Manager", "Atlas PrivateLink SRV string"],
        ["REDIS_URL", "rediss://...:6379", "TLS"],
        ["JWT_PRIVATE_KEY / JWT_PUBLIC_KEY", "Secrets Manager", "RS256, rotated yearly"],
        ["S3_DOCS_BUCKET", "medicore-docs-prod", "Access via ECS task role"],
        ["ROOT_DOMAIN", "medicore.app", "Tenant resolution"],
        ["SMS_PROVIDER, SMS_API_KEY", "msg91 / Secrets Manager", "DLT templates in DB"],
        ["SES_FROM", "no-reply@medicore.app", "Verified domain"],
        ["RAZORPAY_KEY_ID / SECRET", "Secrets Manager", "Patient and SaaS payments"],
        ["SENTRY_DSN", "Secrets Manager", "Error tracking"],
        ["VITE_SENTRY_DSN, VITE_APP_VERSION", "Build-time (web)", "No secrets in web build"],
    ], widths=[0.33, 0.3, 0.37], mono_cols=(0,))

    s += H2("Release and rollback")
    s += bullets([
        "Database changes are backwards compatible (expand, then contract), so the old API "
        "version can run against the new schema during rolling deploys.",
        "ECS deployment circuit breaker rolls back automatically if new tasks fail health "
        "checks.",
        "Web rollback: re-run the deploy job for the previous Git tag; S3 versioning also "
        "allows restoring the previous index.html in seconds.",
        "Feature flags per tenant allow releasing to one pilot hospital first.",
        "Production deploys happen in a low-traffic window (02:00-05:00 IST) with a "
        "status page notice for planned downtime, which should be zero for normal releases.",
    ])
    return s


def security():
    s = []
    s += H1("Security, Compliance and Operations")
    s += H2("Security controls")
    s += table([
        ["Area", "Control"],
        ["Transport", "TLS 1.2+ everywhere, HSTS, internal traffic in private subnets"],
        ["Data at rest", "Atlas encryption, S3 SSE-KMS, encrypted EBS / Redis; field-level "
                         "encryption for Aadhaar, PAN and bank account numbers"],
        ["Application", "OWASP ASVS L2 checklist; Helmet headers; Zod validation on every "
                        "input; Mongo operator injection blocked (sanitize $ keys); output "
                        "encoding in React"],
        ["Authentication", "Argon2id, 2FA, lockout, refresh token rotation with reuse "
                           "detection, session revocation on password change"],
        ["Authorization", "Server-side RBAC on every route; tenant plugin on every query; "
                          "automated tests that try cross-tenant access"],
        ["Files", "Type and size allow-list, antivirus scan (ClamAV Lambda) before file is "
                  "marked available, presigned URLs only"],
        ["Secrets", "Secrets Manager; no secrets in code, images or web build"],
        ["Dependencies", "Dependabot, npm audit in CI, container image scanning in ECR"],
        ["Testing", "Annual third-party penetration test; OWASP ZAP baseline in CI"],
        ["People", "Least-privilege IAM, SSO with MFA for engineers, production access "
                   "via break-glass role with alerts"],
    ], widths=[0.2, 0.8], first_col_bold=True)

    s += H2("Compliance")
    s += bullets([
        "<b>DPDP Act 2023 (India).</b> Consent capture at registration, purpose limitation, "
        "data principal rights (access, correction, erasure where law permits), breach "
        "notification process, data processing agreement with each hospital.",
        "<b>Clinical record retention.</b> Medical records retained per state rules and "
        "hospital policy (commonly 3 years for OPD, longer for IPD and medico-legal cases). "
        "Retention is configurable per record type.",
        "<b>ABDM readiness.</b> ABHA number captured; Phase 1 data model maps to FHIR "
        "resources so ABDM health-record sharing can be added.",
        "<b>NABH support.</b> Audit trails, consent, medication safety checks, critical "
        "value alerts and indicator reports support NABH documentation.",
        "<b>HIPAA-style safeguards.</b> Access logs, minimum necessary access and encryption "
        "make the product suitable for international clients later.",
        "<b>Data residency.</b> All Indian tenant data stays in the Mumbai region.",
    ])

    s += H2("Backup and disaster recovery")
    s += table([
        ["Item", "Policy"],
        ["MongoDB", "Continuous backup with point-in-time restore (last 7 days), daily "
                    "snapshots kept 35 days, monthly kept 1 year; copy to Hyderabad region"],
        ["S3 documents", "Versioning, cross-region replication to ap-south-2, object lock "
                         "for audit exports"],
        ["Targets", "RPO 15 minutes, RTO 4 hours for full region loss; RTO 30 minutes for "
                    "a single-AZ failure (automatic)"],
        ["Restore drills", "Quarterly restore test into staging, documented"],
        ["Tenant export", "Self-service full export for the hospital, any time"],
    ], widths=[0.2, 0.8], first_col_bold=True)

    s += H2("Monitoring and support")
    s += bullets([
        "Structured JSON logs (Pino) with requestId and tenantId to CloudWatch Logs; "
        "PHI is never written to logs.",
        "Alarms: API 5xx above 1%, p95 latency above 800 ms, queue depth, failed jobs, "
        "Mongo CPU and connections, low disk, certificate expiry.",
        "Sentry for front-end and back-end errors with release tracking.",
        "Uptime checks on each region endpoint; public status page.",
        "Support tiers: L1 hospital super user, L2 product support, L3 engineering. "
        "Severity 1 (hospital cannot bill or admit) response in 30 minutes, 24x7.",
    ])
    return s


def quality():
    s = []
    s += H1("Non-Functional Requirements and Testing")
    s += H2("Non-functional requirements")
    s += table([
        ["Category", "Requirement"],
        ["Availability", "99.9% monthly for production (about 43 minutes downtime a month)"],
        ["Performance", "p95 API under 300 ms for reads and 600 ms for writes at 200 "
                        "concurrent users per tenant; patient search under 500 ms on 1 "
                        "million patients; bed board update under 1 s"],
        ["Scalability", "500 tenants and 20,000 concurrent users on the shared cluster by "
                        "scaling ECS tasks and Atlas tier; no code change"],
        ["Front-end", "First load under 3 s on 4G; route chunks lazy-loaded; works on "
                      "Chrome, Edge, Firefox, Safari (last 2 versions); tablet 768 px+"],
        ["Usability", "Common counter tasks in 3 clicks or fewer; full keyboard use for "
                      "billing and pharmacy; English and Hindi"],
        ["Accessibility", "WCAG 2.1 AA for colour contrast and keyboard navigation"],
        ["Printing", "Bills and receipts print in under 2 s; thermal and A4 supported"],
        ["Offline", "Short network drops tolerated: forms keep unsaved data locally and "
                    "retry; full offline mode is not in Phase 1"],
        ["Auditability", "100% of create, update, approve, print and export actions logged"],
    ], widths=[0.18, 0.82], first_col_bold=True)

    s += H2("Testing strategy")
    s += table([
        ["Level", "Tool", "Scope and target"],
        ["Unit", "Vitest", "Services and pure functions (payroll, pricing, FEFO, tax): "
                           "80% line coverage on services"],
        ["API integration", "Supertest + Mongo replica set in Docker", "Every route: auth, "
                                                                        "permission, module "
                                                                        "gate, validation, "
                                                                        "happy path"],
        ["Tenant isolation", "Custom suite", "Every endpoint called with another tenant's "
                                             "IDs must return 404"],
        ["Concurrency", "Custom suite", "Parallel bed allocation, stock sale and counter "
                                        "increment never double-allocate"],
        ["End-to-end", "Playwright", "The journeys in Section 9 run on every release "
                                     "candidate"],
        ["Performance", "k6", "Load profile of a 300-bed hospital at 2x peak"],
        ["Security", "OWASP ZAP, npm audit, pen test", "No high findings open at release"],
        ["UAT", "Pilot hospital", "Signed test scripts per module with client users"],
    ], widths=[0.17, 0.27, 0.56], first_col_bold=True)
    return s


def plan():
    s = []
    s += H1("Phase 1 Delivery Plan and Acceptance")
    s += H2("Team")
    s += table([
        ["Role", "Count", "Responsibility"],
        ["Product manager / BA", "1", "Requirements, flows, UAT, hospital liaison"],
        ["Tech lead / architect", "1", "Architecture, code reviews, core platform"],
        ["Backend developers (Node)", "3", "Modules, APIs, jobs"],
        ["Frontend developers (React)", "3", "Screens, printing, real-time"],
        ["UI/UX designer", "1", "Design system, screens, usability tests"],
        ["QA engineers", "2", "Test cases, automation, performance"],
        ["DevOps engineer", "1 (part-time)", "AWS, CI/CD, monitoring, security"],
        ["Clinical advisor", "1 (part-time)", "Doctor and nursing workflow validation"],
    ], widths=[0.32, 0.15, 0.53], first_col_bold=True)

    s += H2("Timeline (two-week sprints)")
    s += table([
        ["Sprints", "Weeks", "Deliverables"],
        ["0", "1-2", "Design system, repo, CI/CD, AWS dev and staging, auth skeleton"],
        ["1-3", "3-8", "CORE: tenancy, users, roles, maker-checker, Super Admin "
                       "approvals, departments, masters, patient registration, audit, "
                       "notifications, platform console with modules and plans"],
        ["4-5", "9-12", "Billing engine, cashier shifts, printing; OPD schedules, "
                        "booking, queue, consultation, e-prescription"],
        ["6-7", "13-16", "IPD admission, transfers, discharge, real-time bed board; "
                         "Nursing station, MAR, notes"],
        ["8-9", "17-20", "Laboratory and Radiology; Pharmacy with purchase, GRN, FEFO "
                         "dispensing"],
        ["10-11", "21-24", "Inventory and purchase; HR, rosters, attendance, leave"],
        ["12-13", "25-28", "Payroll with statutory outputs; Finance auto-posting and "
                           "statements; reports for all modules"],
        ["14", "29-30", "Performance and security testing, pen test fixes, data "
                        "migration tools"],
        ["15", "31-32", "Pilot hospital go-live, hyper-care, production hardening"],
    ], widths=[0.12, 0.12, 0.76], first_col_bold=True)
    s += callout("About 8 months with the team above. A clinic-only release (CORE, OPD, "
                 "Pharmacy, Lab and billing) can go live after sprint 9 if the business "
                 "wants earlier revenue.", "tip", "Estimate.")

    s += H2("Go-live checklist for each hospital")
    s += numbered([
        "Tenant created with plan, modules, limits and Super Admins.",
        "Hospital profile, branches, departments, wards and beds configured.",
        "Masters imported: services and tariffs, drugs and items with opening stock, "
        "employees, salary structures, chart of accounts with opening balances.",
        "Users created, roles assigned, 2FA enrolled for privileged users.",
        "Print templates and SMS templates approved by the hospital.",
        "Printers, barcode scanners, biometric devices and TV queue screens tested.",
        "Role-wise training completed, with sign-off; super users identified per department.",
        "Parallel run of 2-3 days for billing and pharmacy if migrating from old software.",
        "Go-live day support on site; hyper-care for 2 weeks.",
    ])

    s += H2("Phase 1 acceptance criteria")
    s += bullets([
        "Every user flow in Sections 3 to 9 runs end to end on staging with the pilot "
        "hospital's own masters.",
        "A module that is not subscribed is invisible in the menu and its API returns 402.",
        "No maker can approve their own request; all rules in Section 3 are enforced.",
        "Bills, receipts, lab reports, discharge summaries and payslips print correctly on "
        "A4 and, where specified, thermal printers.",
        "Payroll for one month matches the hospital's manual calculation for a sample of "
        "50 employees, including PF, ESI, PT and TDS.",
        "Trial balance balances after a full test month of transactions.",
        "Performance targets in Section 16 met; no open high-severity security findings.",
        "Production on AWS with web on S3 + CloudFront, automated deploys, backups and "
        "alarms verified by a restore drill.",
    ])

    s += H2("Glossary")
    s += table([
        ["Term", "Meaning"],
        ["UHID", "Unique Health ID, the hospital's permanent patient number"],
        ["OPD / IPD", "Out-patient department / in-patient department"],
        ["ADT", "Admission, discharge and transfer"],
        ["MAR", "Medication administration record"],
        ["LIS / RIS / PACS", "Laboratory, radiology information systems; picture archiving "
                             "and communication system for images"],
        ["FEFO", "First-expiry-first-out stock picking"],
        ["GRN", "Goods receipt note"],
        ["LOP", "Loss of pay (unpaid days)"],
        ["PF / ESI / PT / TDS", "Provident fund, employee state insurance, professional "
                                "tax, tax deducted at source"],
        ["Maker-checker", "Two-person rule: one proposes, another approves"],
        ["Tenant", "One hospital or hospital group using the SaaS"],
        ["OAC", "CloudFront Origin Access Control, lets CloudFront read a private S3 bucket"],
        ["RPO / RTO", "Maximum data loss / maximum downtime after a disaster"],
    ], widths=[0.22, 0.78], first_col_bold=True)
    return s


def story():
    out = deploy() + [PageBreak()] + security() + [PageBreak()] + quality() + \
        [PageBreak()] + plan()
    return out
