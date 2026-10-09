  tabDefs() {
    return { main: 'Pending 5', tabs: ['Pending 5', 'Approved by me', 'Rejected', 'My requests', 'Approval rules'], panels: {
      'Approved by me': { title: 'Approved by me', head: ['Request', 'Maker', 'Level', 'Decided', 'Comment'], rows: [['Bill discount 12% · OP/26-27/000129', 'Neha (Cashier)', 'L2', '08 Oct 16:20', 'Staff family'], ['PO-000409 · ₹42,300', 'Vikram (Purchase)', 'L1', '08 Oct 11:05', 'OK'], ['Tariff change · ECG ₹280 to ₹300', 'Hospital Admin', 'L1', '05 Oct', 'Aligned with market']] },
      'Rejected': { title: 'Rejected', head: ['Request', 'Maker', 'Rejected by', 'When', 'Reason'], rows: [['Cancellation CX-0033', 'Ravi (Cashier 2)', 'Billing Manager', '07 Oct', 'Bill already printed and paid; raise refund instead']] },
      'My requests': { title: 'My requests', head: ['Request', 'Raised', 'Waiting with', 'Status'], rows: [['Role change: Front Office to Billing Manager (Rahul Mehta)', '08 Oct', 'Super Admin', '~ba:Pending'], ['Reopen September payroll', '02 Oct', '-', '~br:Rejected']] },
      'Approval rules': { title: 'Approval rules', sub: 'Who must approve what. Changing a rule also needs Super Admin approval.', acts: ['Add rule'],
        head: ['Action', 'Maker', 'Checker L1', 'Checker L2 when', 'Expires after'],
        rows: [['Bill discount', 'Cashier', 'Billing Manager', 'Over 10% or ₹10,000: Super Admin', '48 h'], ['Refund or cancellation', 'Cashier', 'Billing Manager', 'Over ₹25,000: Finance Controller', '48 h'], ['Purchase order', 'Purchase', 'HOD', 'Over ₹1,00,000: Super Admin', '72 h'], ['Stock adjustment', 'Store / Pharmacist', 'Pharmacy In-charge', 'Over ₹5,000: Finance', '48 h'], ['Payroll release', 'Payroll Officer', 'HR Manager', 'Always: Finance Controller', '72 h'], ['Medical record release', 'MRD Officer', 'Medical Superintendent', '-', '72 h']] }
    } };
  }
