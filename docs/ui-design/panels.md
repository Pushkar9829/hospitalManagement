# Role panels

Each role logs in to its own panel: its own home page, menu and data scope. The menu below is exactly what that role sees. Anything not listed is hidden from the menu and refused by the API.

## Super Admin

- Roles: Hospital Super Admin
- Home: boards/Dashboard.dc.html
- Data scope: Whole hospital, all branches
- Menu:
  - **Overview:** Dashboard, Approvals, Reports, Audit Log
  - **Patients:** Patients, Patient Profile, Front Office, Appointments, Admissions, Bed Board, Discharge Desk
  - **Clinical:** Consultation, In-patient Rounds, Nursing Station, Rosters
  - **Diagnostics:** Laboratory, Radiology, Pharmacy
  - **Business:** Billing, Finance, Inventory, HR, Payroll
  - **Support:** Medical Records, Diet & Kitchen, Facility, Quality, CRM
  - **Settings:** Hospital Settings, Users, Roles & Access, Departments, Subscription
  - **Personal:** My Space

## Hospital Admin

- Roles: Hospital Admin
- Home: boards/HomeAdmin.dc.html
- Data scope: Branch
- Menu:
  - **Overview:** Home, Approvals, Reports
  - **Operations:** Patients, Front Office, Bed Board, Inventory
  - **Settings:** Hospital Settings, Users, Roles & Access, Departments
  - **Personal:** My Space

## Medical Superintendent

- Roles: Medical Superintendent
- Home: boards/HomeMedSupt.dc.html
- Data scope: Branch, clinical
- Menu:
  - **Overview:** Home, Approvals, Reports
  - **Clinical:** Bed Board, Discharge Desk, Nursing Station, Rosters
  - **Governance:** Medical Records, Quality
  - **Personal:** My Space

## Doctor

- Roles: Consultant, Resident
- Home: boards/HomeDoctor.dc.html
- Data scope: Own patients and department
- Menu:
  - **My day:** Home, OPD Consultation, In-patient Rounds, Discharge Desk
  - **Patients:** Patient Profile, Bed Board
  - **Results:** Laboratory, Radiology
  - **Personal:** My Space

## Staff Nurse

- Roles: Staff Nurse
- Home: boards/HomeNurse.dc.html
- Data scope: Assigned ward
- Menu:
  - **My ward:** Home, Nursing Station, Bed Board, Patient Profile
  - **Requests:** Diet Orders, Tickets and Transport, Report Incident
  - **Personal:** My Space

## Ward In-charge

- Roles: Ward In-charge, Nursing Superintendent
- Home: boards/HomeWardIncharge.dc.html
- Data scope: Ward
- Menu:
  - **My ward:** Home, Nursing Station, Rosters, Bed Board
  - **Requests:** Approvals, Store Indents, Facility, Quality
  - **Personal:** My Space

## Front Office

- Roles: Front Office, Admission Desk
- Home: boards/HomeFrontOffice.dc.html
- Data scope: Branch
- Menu:
  - **Front desk:** Home, Front Office, Register Patient, Patient Profile, Appointments
  - **In-patients:** Admissions, Bed Board
  - **Personal:** My Space

## Cashier

- Roles: Cashier
- Home: boards/HomeCashier.dc.html
- Data scope: Own counter
- Menu:
  - **Counter:** Home, Billing Counter, Find Patient
  - **Reports:** Collection Reports
  - **Personal:** My Space

## Billing Manager

- Roles: Billing Manager
- Home: boards/HomeBillingMgr.dc.html
- Data scope: Branch billing
- Menu:
  - **Billing:** Home, Billing, Discharge Desk, Approvals
  - **Reports:** Reports
  - **Personal:** My Space

## Laboratory

- Roles: Lab Technician, Pathologist
- Home: boards/HomeLab.dc.html
- Data scope: Laboratory
- Menu:
  - **Laboratory:** Home, Worklists, Patient Profile
  - **Requests:** Store Indents, Quality
  - **Personal:** My Space

## Radiology

- Roles: Radiology Technician, Radiologist
- Home: boards/HomeRadiology.dc.html
- Data scope: Radiology
- Menu:
  - **Radiology:** Home, Worklist and Reporting, Patient Profile
  - **Requests:** Equipment Tickets
  - **Personal:** My Space

## Pharmacy

- Roles: Pharmacist, Pharmacy In-charge
- Home: boards/HomePharmacy.dc.html
- Data scope: Pharmacy stores
- Menu:
  - **Pharmacy:** Home, Dispensing, Stock
  - **Reports:** Reports
  - **Personal:** My Space

## Store and Purchase

- Roles: Store Keeper, Purchase Manager
- Home: boards/HomeStore.dc.html
- Data scope: Stores
- Menu:
  - **Stores:** Home, Inventory, Approvals
  - **Reports:** Reports
  - **Personal:** My Space

## HR

- Roles: HR Manager, HR Executive
- Home: boards/HomeHr.dc.html
- Data scope: All employees
- Menu:
  - **People:** Home, HR and Attendance, Rosters, Payroll
  - **Work:** Approvals, Reports
  - **Personal:** My Space

## Payroll

- Roles: Payroll Officer
- Home: boards/HomePayroll.dc.html
- Data scope: Payroll entity
- Menu:
  - **Payroll:** Home, Payroll Run, Attendance
  - **Reports:** Reports
  - **Personal:** My Space

## Accounts

- Roles: Accountant, Finance Controller
- Home: boards/HomeAccounts.dc.html
- Data scope: Legal entity
- Menu:
  - **Finance:** Home, Finance, Approvals
  - **Source modules:** Billing, Payroll, Inventory
  - **Reports:** Reports
  - **Personal:** My Space

## Medical Records

- Roles: MRD Officer, Medical Coder
- Home: boards/HomeMrd.dc.html
- Data scope: All records, no billing
- Menu:
  - **Records:** Home, Medical Records, Patient Profile
  - **Reports:** Reports
  - **Personal:** My Space

## Kitchen

- Roles: Dietitian, Kitchen Supervisor
- Home: boards/HomeKitchen.dc.html
- Data scope: Kitchen
- Menu:
  - **Kitchen:** Home, Diet and Kitchen, Kitchen Store
  - **Personal:** My Space

## Facility

- Roles: Housekeeping Supervisor, Maintenance, Biomedical Engineer
- Home: boards/HomeFacility.dc.html
- Data scope: Branch facilities
- Menu:
  - **Facility:** Home, Housekeeping and Facility, Bed Board, Store Indents
  - **Personal:** My Space

## Quality

- Roles: Quality Manager, Infection Control Nurse
- Home: boards/HomeQuality.dc.html
- Data scope: Whole hospital, read-only clinical
- Menu:
  - **Quality:** Home, Quality and Incidents, Medical Records
  - **Reports:** Reports
  - **Personal:** My Space

## CRM and Call Centre

- Roles: CRM Executive, Call Centre
- Home: boards/HomeCrm.dc.html
- Data scope: Patients, no clinical notes
- Menu:
  - **Engagement:** Home, CRM, Appointments, Patients
  - **Reports:** Reports
  - **Personal:** My Space

## Employee

- Roles: Every staff login
- Home: boards/MySpace.dc.html
- Data scope: Own records
- Menu:
  - **Personal:** My Space

## Platform owner

- Home: boards/Console.dc.html, tenant detail boards/ConsoleTenant.dc.html
- Data scope: all tenants; never patient data without a consented support session

## Patient

- Home: boards/Portal.dc.html (mobile web, OTP login)
- Data scope: own and linked family records
