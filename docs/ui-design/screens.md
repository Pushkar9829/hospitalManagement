# Screen inventory

Every board on the design canvas, with its web route, main role, module gate, permission and main APIs.

| Board | File | Route | Primary role | Module | Permission | Main APIs |
|---|---|---|---|---|---|---|
| Overview | boards/Main.dc.html | - | All | - | - | - |
| Design system | boards/DesignSystem.dc.html | - | All | - | - | - |
| Login and 2FA | boards/Login.dc.html | /login | All users | CORE | public | POST /auth/login, /auth/2fa/verify |
| Pricing and signup | boards/Signup.dc.html | www/pricing | Prospect | Platform | public | GET /public/plans, POST /public/signup |
| Setup wizard | boards/SetupWizard.dc.html | /setup | Super Admin | CORE | settings:* | PUT /branches, /departments, POST /masters/{type}/import |
| Platform console | boards/Console.dc.html | console/ | Platform owner | Platform | platform:* | GET /platform/tenants, /platform/metrics |
| Subscription | boards/Subscription.dc.html | /settings/subscription | Super Admin | CORE | settings:subscription:read | GET /subscription, POST /subscription/preview |
| Admin dashboard | boards/Dashboard.dc.html | / | Admin | CORE | dashboard:admin:read | GET /dashboard/summary |
| Approvals | boards/Approvals.dc.html | /approvals | Checkers | CORE | approvals:inbox:read | GET /approvals, POST /approvals/{id}/decision |
| Reports | boards/Reports.dc.html | /reports | Managers | All | reports:{module}:read | GET /reports/{code}, POST /reports/{code}/export |
| Audit log | boards/AuditLog.dc.html | /audit | Super Admin | CORE | audit:log:read | GET /audit |
| Hospital settings | boards/Settings.dc.html | /settings | Super Admin | CORE | settings:hospital:* | GET/PUT /settings, /branches, /templates |
| Users | boards/Users.dc.html | /settings/users | Admin | CORE | settings:user:* | CRUD /users |
| Roles and access | boards/Roles.dc.html | /settings/roles | Super Admin | CORE | settings:role:* | CRUD /roles |
| Departments and masters | boards/Departments.dc.html | /settings/masters | Admin | CORE | settings:master:* | CRUD /departments, /masters/{type} |
| Patient registration | boards/Patients.dc.html | /patients/new | Front Office | CORE | patients:patient:create | GET /patients?q=, POST /patients |
| Patient profile | boards/PatientProfile.dc.html | /patients/:id | Clinical, front office | CORE | patients:patient:read | GET /patients/{id}, /patients/{id}/timeline |
| Front office | boards/FrontOffice.dc.html | /front-office | Front Office | CORE | frontoffice:* | POST /front-office/tokens, /passes |
| OPD appointments | boards/Opd.dc.html | /opd | Front Office | OPD | opd:appointment:* | GET /opd/slots, POST /opd/appointments |
| Consultation | boards/Consult.dc.html | /opd/visits/:id | Doctor | OPD | opd:consultation:write | PUT /opd/visits/{id}/consultation |
| Admission | boards/Admission.dc.html | /ipd/admit | Admission Desk | IPD | ipd:admission:create | POST /ipd/admissions |
| Bed board | boards/Beds.dc.html | /ipd/beds | Admission Desk | IPD | ipd:bed:read | GET /ipd/beds + socket bed:update |
| Discharge desk | boards/Discharge.dc.html | /ipd/discharge | Doctor, billing | IPD | ipd:discharge:* | PUT /ipd/admissions/{id}/discharge-summary |
| Nursing station | boards/Nursing.dc.html | /nursing/:wardId | Staff Nurse | NUR | nursing:* | GET /nursing/wards/{id}/census, POST /nursing/mar/{doseId}/administer |
| Shift roster | boards/Roster.dc.html | /hr/rosters | Ward In-charge | HRM | hr:roster:write | GET/PUT /hr/rosters |
| Laboratory | boards/Lab.dc.html | /lab | Lab, pathologist | LAB | lab:* | GET /lab/worklists, PUT /lab/tests/{id}/results |
| Radiology | boards/Radiology.dc.html | /radiology | Radiologist | RAD | rad:* | PUT /rad/studies/{id}/report, POST /sign |
| Pharmacy | boards/Pharmacy.dc.html | /pharmacy | Pharmacist | PHR | pharmacy:* | GET /pharmacy/rx-queue, POST /pharmacy/sales |
| Billing counter | boards/Billing.dc.html | /billing | Cashier | CORE | billing:* | POST /billing/bills, /bills/{id}/payments |
| Finance | boards/Finance.dc.html | /finance | Accountant | FIN | finance:* | GET /finance/trial-balance, POST /finance/vouchers |
| Inventory | boards/Inventory.dc.html | /inventory | Store Keeper | INV | inventory:* | GET /inventory/stock, POST /inventory/purchase-orders |
| HR | boards/Hr.dc.html | /hr | HR Manager | HRM | hr:* | CRUD /hr/employees, POST /hr/leave-requests/{id}/decision |
| Payroll | boards/Payroll.dc.html | /payroll | Payroll Officer | PAY | payroll:* | POST /payroll/runs, GET /payroll/runs/{id} |
| Medical records | boards/Records.dc.html | /records | MRD Officer | MRD | mrd:* | GET /mrd/deficiencies, POST /mrd/births, /mrd/deaths |
| Diet and kitchen | boards/Diet.dc.html | /diet | Dietitian | DIET | diet:* | GET /diet/production, PUT /diet/orders/{id} |
| Facility | boards/Facility.dc.html | /facility | Supervisor | FAC | facility:* | GET /facility/hk-tasks, POST /facility/tickets |
| Quality | boards/Quality.dc.html | /quality | Quality Manager | QLT | quality:* | POST /quality/incidents, GET /quality/indicators |
| Patient CRM | boards/Crm.dc.html | /crm | CRM Executive | CRM | crm:* | CRUD /crm/leads, POST /crm/campaigns |
| My space | boards/MySpace.dc.html | /me | Every employee | HRM | self | GET /payroll/payslips/me, POST /hr/leave-requests |
| Queue TV | boards/QueueTV.dc.html | /display/queue | Display screen | OPD | display token | socket queue:update |
| Patient portal | boards/Portal.dc.html | /my (patient) | Patient | CORE | patient OTP | POST /portal/auth/otp, GET /portal/me/documents |
| Print templates | boards/PrintBill.dc.html | server PDF | - | CORE | billing:bill:print | GET /billing/bills/{id}/pdf |
| Screen states | boards/States.dc.html | - | All | - | - | Error format in API docs |

## Build rules

1. Routes above are web app paths; API paths are under /api/v1 as in the API documentation.
2. Every screen checks module and permission on the server. The UI hides menu items but never relies on that.
3. Tabs, filters and selected rows live in the URL (?tab=, ?q=, ?id=) so links can be shared and Back works.
4. Tables page on the server: 25 rows default, 100 max. Show the total count.
5. Money is stored in paise and shown with the Indian grouping (₹1,23,456.00). Dates show as 09 Oct 2026; times 24-hour.
6. IDs (UHID, bill, IP, batch) use the mono font so they can be read and copied.
7. A 202 APPROVAL_PENDING response shows the waiting banner from the Screen states board.
8. Live screens (bed board, queue, approvals, nursing tasks) subscribe to Socket.IO and refetch after reconnect.
9. Every form uses the Zod schema shared with the API; validate on blur and on submit.
10. Keyboard: all actions reachable by Tab; Enter submits; billing and pharmacy support shortcut keys listed in each screen’s help.
11. Accessibility: WCAG 2.1 AA contrast, visible focus ring, labels on every input, colour never the only signal.
12. Sample data on boards is illustrative. Use the real API; never ship sample names.

## Components to MUI

| Pattern | Build with | Notes |
|---|---|---|
| Side menu | Drawer (permanent) + List | Built from subscribed modules and permissions; active item = filled + accent marker |
| Top bar | AppBar + Autocomplete | Global search by UHID, name, mobile, bill no.; approvals badge; user menu |
| Tabs (segmented) | Tabs or ToggleButtonGroup | Sync the tab to the URL: ?tab=gst |
| Card with header | Card + CardHeader | Title left, actions right; wraps on small screens |
| Data table | MUI X DataGrid | Server-side paging, sorting and filters; sticky header; row click opens detail |
| Status chip | Chip size="small" | Always colour + text; colour pairs from tokens |
| Stat tile | Card + Typography | Label, value, one-line context; links to the detail screen |
| Forms | React Hook Form + Zod + TextField | Same Zod schema as the API; errors under fields; 44 px controls |
| Stepper flows | Stepper | Admission, payroll run, setup wizard; steps clickable when allowed |
| Bed tiles, slot grid | Grid + ButtonBase | Keyboard reachable; live updates via Socket.IO |
| Kanban boards | Grid columns + Card | Housekeeping, CRM leads; move buttons as well as drag |
| Dialogs | Dialog | Confirm risky actions; reason field when required |
| Toasts | notistack Snackbar | 5 s; never the only place an error is shown |
| Print layouts | Server-side PDF (pdfmake) | Match the Print templates page; A4, A5, 80 mm thermal |
