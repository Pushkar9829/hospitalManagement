# Hospital Management System - Phase 1 Specification

`Hospital_Management_System_Phase1_Specification.pdf` is the full Phase 1 product and technical
specification for the multi-tenant SaaS hospital management system. It covers:

- Module catalogue, module-wise subscription plans, pricing model and enforcement rules
- SaaS platform: self-service signup, tenant provisioning, subscription billing with
  proration and GST, metering, custom domains, Platform Console, SaaS metrics, SLAs,
  platform APIs and code
- Roles, permissions, logins, maker-checker and Super Admin approvals
- Every Phase 1 module with features, user flows, business rules and reports:
  Core setup and departments, patient registration, OPD, IPD and real-time beds,
  nursing, doctor scheduling, rosters, laboratory, radiology, pharmacy, billing,
  finance, inventory, HR, recruitment, training, attendance, leave and payroll,
  medical records with birth, death and medico-legal registers, diet and kitchen,
  housekeeping, linen, maintenance, biomedical equipment and waste, quality and
  incidents, front office, patient portal and health check-ups
- End-to-end journeys across modules and the screen map
- Architecture (React, Node.js, MongoDB), database design and reference source code
- REST API documentation with request and response examples
- AWS deployment (React on S3 + CloudFront, API on ECS Fargate), CI/CD, security,
  non-functional requirements, testing, delivery plan and acceptance criteria

## Regenerating the PDF

The PDF is generated from the Python sources in `spec-src/` with ReportLab.

```bash
pip install reportlab
python3 docs/spec-src/build.py
```

Each chapter lives in its own `c*.py` file. Shared styles and diagram helpers are in
`spec-src/kit.py`.
