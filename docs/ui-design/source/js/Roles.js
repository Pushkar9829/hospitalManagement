  renderVals() {
    var sel = (this.state && this.state.sel) || 'Staff Nurse';
    var R = [['Hospital Super Admin', 2], ['Hospital Admin', 3], ['Consultant Doctor', 46], ['Resident Doctor', 22], ['Staff Nurse', 138], ['Ward In-charge', 12], ['Front Office Executive', 14], ['Cashier', 9], ['Billing Manager', 2], ['Lab Technician', 11], ['Pathologist', 3], ['Pharmacist', 8], ['Store Keeper', 4], ['HR Manager', 2], ['Payroll Officer', 1], ['Accountant', 3], ['MRD Officer', 2], ['Quality Manager', 1], ['CRM Executive', 4], ['Employee (self-service)', 412]];
    var P = [['Patients', 'Patient record', 1, 0, 0, 0, 1], ['IPD', 'Bed board', 1, 0, 0, 0, 0], ['Nursing', 'Vitals', 1, 1, 1, 0, 1], ['Nursing', 'Medication administration', 1, 1, 0, 0, 1], ['Nursing', 'Nursing notes', 1, 1, 1, 0, 1], ['Nursing', 'Indents', 1, 1, 1, 0, 0], ['Nursing', 'ICU chart', 1, 1, 1, 0, 1], ['Laboratory', 'Results', 1, 0, 0, 0, 1], ['Pharmacy', 'Ward issues', 1, 1, 0, 0, 0], ['Diet', 'Diet orders', 1, 1, 0, 0, 0], ['Facility', 'Maintenance tickets', 1, 1, 0, 0, 0], ['Quality', 'Incident reports', 1, 1, 0, 0, 0], ['Billing', 'Running bill', 0, 0, 0, 0, 0]];
    return {
      nav: this.navItems('Roles'), sel: sel,
      roles: R.map((r) => ({ n: r[0], u: r[1], on: r[0] === sel, off: r[0] !== sel, pick: () => this.setState({ sel: r[0] }) })),
      perms: P.map(function (p) { return { m: p[0], r: p[1], v: !!p[2], c: !!p[3], e: !!p[4], a: !!p[5], x: !!p[6] }; })
    };
  }
