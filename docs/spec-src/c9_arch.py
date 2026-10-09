from kit import *
from kit import _arrow
from reportlab.platypus import Flowable, PageBreak, Spacer
from reportlab.lib import colors


class ArchDiagram(Flowable):
    """AWS deployment architecture."""

    def wrap(self, aw, ah):
        self.aw = aw
        return aw, 330

    def box(self, x, y, w, h, title, sub="", fill=None, stroke=NAVY):
        c = self.canv
        c.setFillColor(fill or colors.white)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.9)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("Body-Bold", 8.2)
        c.drawCentredString(x + w / 2, y + h / 2 + (2 if sub else -3), title)
        if sub:
            c.setFont("Body", 7)
            c.setFillColor(MUTED)
            c.drawCentredString(x + w / 2, y + h / 2 - 8, sub)

    def group(self, x, y, w, h, label, color):
        c = self.canv
        c.setStrokeColor(color)
        c.setDash(3, 2)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, 7, fill=0, stroke=1)
        c.setDash()
        c.setFillColor(color)
        c.setFont("Body-Bold", 7.6)
        c.drawString(x + 6, y + h - 10, label)

    def draw(self):
        W = self.aw
        bw, bh = 104, 34
        # users
        self.box(0, 280, 120, 38, "Hospital users", "browsers, tablets", ORANGE_LT, ORANGE)
        self.box(W - 120, 280, 120, 38, "Patients", "SMS links, booking page",
                 ORANGE_LT, ORANGE)
        # edge
        self.box(W / 2 - 130, 280, 120, 38, "Route 53 + ACM", "DNS, TLS certificates",
                 NAVY_LT)
        self.box(W / 2 + 10, 280, 120, 38, "CloudFront + WAF", "CDN, edge security",
                 NAVY_LT)
        _arrow(self.canv, 120, 299, W / 2 - 131, 299)
        _arrow(self.canv, W / 2 - 10, 299, W / 2 + 9, 299)
        _arrow(self.canv, W - 121, 299, W / 2 + 131, 299)
        # AWS VPC group
        self.group(0, 0, W, 262, "AWS Region (ap-south-1 Mumbai)", NAVY)
        # S3 frontend
        cx = W / 2 + 70
        self.box(14, 205, bw + 20, bh + 6, "S3: web app bucket", "React build, private + OAC",
                 GREEN_LT, GREEN)
        _arrow(self.canv, cx - 20, 279, 14 + (bw + 20) / 2 + 10, 246)
        self.canv.setFont("Body", 6.8)
        self.canv.setFillColor(MUTED)
        self.canv.drawString(70, 262 - 6, "/*  static files")
        # ALB
        self.box(cx - 52, 205, bw, bh + 6, "Application LB", "/api/*, /socket.io/*")
        _arrow(self.canv, cx, 279, cx, 246)
        # private subnet group
        self.group(150, 70, W - 164, 120, "Private subnets (2 AZs)", ORANGE)
        self.box(164, 120, bw + 6, bh + 10, "ECS Fargate: API", "Node.js, Express, Socket.IO")
        self.box(164 + bw + 22, 120, bw + 6, bh + 10, "ECS Fargate: Worker",
                 "BullMQ jobs, PDFs, payroll")
        self.box(164 + 2 * (bw + 22), 120, bw - 10, bh + 10, "ElastiCache", "Redis 7")
        self.box(164, 78, 2 * bw + 28, 30, "MongoDB Atlas (PrivateLink)",
                 "3-node replica set, encrypted, PITR backups", GREEN_LT, GREEN)
        self.box(164 + 2 * (bw + 22), 78, bw - 10, 30, "Secrets Manager", "keys, DB URI")
        _arrow(self.canv, cx, 204, 164 + (bw + 6) / 2 + 40, 165)
        # side services
        self.box(14, 120, bw + 20, bh + 10, "S3: documents bucket", "SSE-KMS, signed URLs",
                 GREEN_LT, GREEN)
        self.box(14, 70, bw + 20, 34, "SES / SMS / WhatsApp", "notification providers")
        self.box(14, 14, bw + 20, 34, "ECR", "Docker images")
        self.box(164, 14, 2 * bw + 28, 34, "CloudWatch + X-Ray", "logs, metrics, alarms, traces")
        self.box(164 + 2 * (bw + 22), 14, bw - 10, 34, "AWS Backup", "S3 versioning")
        _arrow(self.canv, 163, 142, 14 + bw + 21, 142)


def story():
    s = []
    s += H1("Technical Architecture")
    s += H2("Technology stack")
    s += table([
        ["Layer", "Choice", "Why"],
        ["Web app", "React 18, TypeScript, Vite", "Fast builds, static output for S3, typed "
                                                  "code shared with API"],
        ["UI kit", "MUI 6 + MUI X Data Grid", "Accessible components and heavy data tables "
                                             "for billing, stock, payroll"],
        ["State and data", "Redux Toolkit + RTK Query", "Caching, auto-refetch, typed API "
                                                        "hooks"],
        ["Forms", "React Hook Form + Zod", "Same Zod schemas validate on client and server"],
        ["Real-time", "Socket.IO client", "Bed board, queue screen, approvals, alerts"],
        ["API", "Node.js 24 LTS, Express 5, TypeScript", "Simple, widely known, large "
                                                          "ecosystem"],
        ["Database", "MongoDB 8 (Atlas) + Mongoose 8", "Flexible clinical documents, "
                                                       "transactions on replica sets"],
        ["Cache and queues", "Redis 7 + BullMQ", "Sessions blacklist, rate limits, background "
                                                "jobs (PDFs, SMS, payroll, reports)"],
        ["Documents", "Amazon S3 + pdfmake", "Generated PDFs and uploads in private bucket"],
        ["Auth", "JWT (RS256) + refresh rotation, Argon2id, TOTP", "Stateless API, strong "
                                                                     "password hashing, 2FA"],
        ["API docs", "OpenAPI 3.1 generated from Zod", "Swagger UI at /api/docs, always in "
                                                        "sync with code"],
        ["Testing", "Vitest, Supertest, Playwright", "Unit, API and end-to-end tests"],
        ["Hosting", "S3 + CloudFront (web), ECS Fargate (API, worker)", "Serverless "
                                                                        "containers, no "
                                                                        "servers to patch"],
        ["CI/CD", "GitHub Actions", "Build, test, deploy on merge to main"],
        ["Monitoring", "CloudWatch, Sentry", "Logs, metrics, alarms, front-end errors"],
    ], widths=[0.17, 0.35, 0.48], first_col_bold=True)

    s += H2("Deployment architecture on AWS")
    s.append(P("The React app is a set of static files in a private S3 bucket. CloudFront "
               "serves them worldwide over HTTPS and forwards <font name='Mono' size='8.5'>"
               "/api</font> and <font name='Mono' size='8.5'>/socket.io</font> traffic to the "
               "Node API behind an Application Load Balancer. Both web and API share one "
               "domain per tenant, so no CORS setup is needed."))
    s.append(Spacer(1, 4))
    s.append(ArchDiagram())
    s.append(Spacer(1, 8))
    s += table([
        ["Component", "Configuration (production)"],
        ["S3 web bucket", "Block all public access. CloudFront Origin Access Control. "
                          "index.html cached 60 s, hashed assets cached 1 year"],
        ["CloudFront", "Wildcard certificate *.medicore.app in us-east-1. Behaviours: "
                       "default to S3, /api/* and /socket.io/* to ALB with caching off. "
                       "SPA fallback: 403/404 to /index.html. AWS WAF managed rules"],
        ["ECS API service", "2-6 Fargate tasks (1 vCPU, 2 GB), auto-scaling on CPU 60% and "
                            "request count. Sticky sessions for Socket.IO plus Redis adapter"],
        ["ECS worker service", "1-4 tasks, scales on BullMQ queue depth"],
        ["MongoDB Atlas", "M30 or higher, 3-node replica set across AZs in Mumbai, "
                          "PrivateLink, encryption at rest, continuous backup with "
                          "point-in-time restore"],
        ["Redis", "ElastiCache, 2 nodes, Multi-AZ, encryption in transit"],
        ["S3 documents bucket", "Versioning, SSE-KMS, lifecycle to Glacier after 1 year, "
                                "access only via presigned URLs (5 minutes)"],
        ["Environments", "dev, staging, production in separate AWS accounts"],
    ], widths=[0.22, 0.78], first_col_bold=True)
    s += callout("For a single small hospital or a pilot, run the API and worker with PM2 on "
                 "one EC2 t3.medium behind Nginx, MongoDB Atlas M10 and the same S3 + "
                 "CloudFront web hosting. The code is identical; only infrastructure "
                 "changes. Expected cost is about USD 120-180 per month versus about "
                 "USD 900-1,400 for the production layout above.", "tip", "Starter setup.")

    s += H2("Multi-tenancy")
    s += bullets([
        "<b>Tenant resolution.</b> The sub-domain (e.g. citycare.medicore.app) or a custom "
        "domain maps to a tenant. The API reads the Host header, looks up the tenant in "
        "a cached registry, and puts it on the request context.",
        "<b>Data isolation.</b> Shared database by default. Every tenant-owned document has "
        "<font name='Mono' size='8.5'>tenantId</font>. A Mongoose plugin adds the filter to "
        "every query automatically and refuses queries that lack it.",
        "<b>Dedicated database.</b> Enterprise tenants can get their own database in the "
        "same or a separate cluster. The connection is chosen per request; code is "
        "unchanged.",
        "<b>Storage isolation.</b> S3 keys are prefixed with "
        "<font name='Mono' size='8.5'>tenants/{tenantId}/</font>. IAM policies on the API "
        "role restrict access to these buckets only.",
        "<b>Module gating.</b> Tenant document holds active modules and limits. Middleware "
        "rejects calls to unsubscribed modules with HTTP 402 and code MODULE_NOT_SUBSCRIBED.",
    ])

    s += H2("Backend structure: modular monolith")
    s.append(P("The API is one deployable application split into modules that mirror the "
               "subscription modules. Modules talk to each other only through service "
               "interfaces and domain events, never by reading each other's collections. "
               "This keeps Phase 1 simple to run and lets a module be split into its own "
               "service later if load demands it."))
    s += code("""
apps/
  web/                      React app (hospital users)          -> S3 + CloudFront
  console/                  React app (platform owner)          -> S3 + CloudFront
  booking/                  Public appointment booking page      -> S3 + CloudFront
  api/
    src/
      app.ts                Express app, middleware chain
      server.ts             HTTP + Socket.IO bootstrap
      worker.ts             BullMQ worker entry
      config/               env loading and validation (Zod)
      core/                 shared kernel
        auth/ tenancy/ rbac/ approvals/ audit/ sequences/ files/ notify/ events/
      modules/
        core-setup/ patients/ billing/ staff/        (CORE)
        opd/ ipd/ nursing/ lab/ radiology/ pharmacy/ inventory/ hr/ payroll/ finance/
          <module>/
            <module>.routes.ts      route table + permission per route
            <module>.controller.ts  HTTP in/out only
            <module>.service.ts     business rules, transactions
            <module>.schemas.ts     Zod request/response schemas (=> OpenAPI)
            models/                 Mongoose models
            events.ts               domain events published / consumed
            jobs.ts                 background jobs
            __tests__/
packages/
  shared/                   Zod schemas, enums, permission constants used by web + api
  ui/                       shared React components (PatientBanner, DataTable, PrintFrame)
infra/                      Terraform for AWS (S3, CloudFront, ECS, ALB, Redis, IAM)
.github/workflows/          CI/CD pipelines
""", "Repository layout (pnpm monorepo)")

    s += H2("Request lifecycle")
    s += flow([
        ("CloudFront", "Routes /api/* to ALB, adds request id"),
        ("tenantResolver", "Host header to tenant; checks subscription state"),
        ("authenticate", "Verifies JWT, loads user and permissions"),
        ("requireModule", "Rejects if module not subscribed (402)"),
        ("authorize", "Checks permission and data scope (403)"),
        ("validate", "Zod validates body, query, params (422)"),
        ("controller/service", "Business rules in a DB transaction"),
        ("audit + events", "Audit record; domain event to queue"),
    ], box_h=46)

    s += H2("Domain events")
    s.append(P("Cross-module work happens through events on a BullMQ queue, published "
               "after the database transaction commits (outbox pattern). This keeps "
               "modules independent and makes retries safe."))
    s += table([
        ["Event", "Published by", "Consumed by"],
        ["patient.registered", "Patients", "Notify (welcome SMS)"],
        ["opd.visit.checkedIn", "OPD", "Billing (consult fee), Queue screen"],
        ["order.created", "OPD / IPD", "LAB, RAD, PHR worklists; Billing charges"],
        ["lab.result.released", "LAB", "EMR timeline, Notify, Doctor alerts"],
        ["ipd.admitted / transferred / discharged", "IPD", "Beds, Nursing, Billing, Notify"],
        ["pharmacy.issued", "PHR", "Billing, Finance (COGS)"],
        ["billing.payment.received", "Billing", "Finance journal, Notify (e-receipt)"],
        ["inventory.grn.approved", "INV / PHR", "Finance payable, stock alerts"],
        ["hr.leave.approved", "HRM", "Roster, OPD slot blocking, Attendance"],
        ["payroll.run.locked", "PAY", "Finance journal, Payslip PDFs, Notify"],
        ["approval.decided", "Approvals", "Owning module applies or discards change"],
    ], widths=[0.36, 0.2, 0.44], mono_cols=(0,))
    return s
