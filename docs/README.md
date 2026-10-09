# MediCore HMS - Phase 1 Specification

`MediCore_HMS_Phase1_Specification.pdf` is the full Phase 1 product and technical
specification for the hospital management system. It covers:

- Module catalogue, module-wise subscription plans, pricing model and enforcement rules
- Roles, permissions, logins, maker-checker and Super Admin approvals
- Every Phase 1 module with features, user flows, business rules and reports:
  Core setup and departments, patient registration, OPD, IPD and real-time beds,
  nursing, doctor scheduling, rosters, laboratory, radiology, pharmacy, billing,
  finance, inventory, HR, attendance, leave and payroll
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
