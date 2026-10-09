  renderVals() {
    var stage = (this.state && this.state.stage) || 'Validate';
    var S = [['Collect', 14], ['Receive', 6], ['Result entry', 22], ['Validate', 9], ['Released', 188], ['Home collection', 11]];
    return {
      nav: this.navItems('Lab'), stage: stage + ' worklist',
      stages: S.map((s) => ({ l: s[0], n: s[1], on: s[0] === stage, off: s[0] !== stage, pick: () => this.setState({ stage: s[0] }) })),
      samples: [['LB-26-018842', 'F. Ali', 'CBC · W2-204-A', 'Critical', 'br'], ['LB-26-018851', 'Ravi Kumar', 'Lipid profile · OPD', 'Routine', 'bn'], ['LB-26-018853', 'Ravi Kumar', 'HbA1c · OPD', 'Routine', 'bn'], ['LB-26-018860', 'Baby Ishan', 'CRP · Paeds', 'Urgent', 'bo'], ['LB-26-018861', 'K. Nair', 'ABG · ICU', 'STAT', 'br'], ['LB-26-018870', 'Home · Meena J.', 'Thyroid profile', 'Routine', 'bn'], ['LB-26-018874', 'S. Patil', 'Blood culture · prelim', 'Micro', 'bb']].map(function (s, i) { return { bc: s[0], n: s[1], t: s[2], p: s[3], pc: s[4], bg: i === 0 ? '#E6EEF9' : 'transparent' }; }),
      params: [['Haemoglobin', '9.1', 'g/dL', '12.0 to 15.0', 'Low', 'ba', '10.4'], ['WBC count', '14,200', '/µL', '4,000 to 11,000', 'High', 'ba', '9,800'], ['Platelets', '38,000', '/µL', '1,50,000 to 4,10,000', 'Critical low', 'br', '92,000'], ['Haematocrit', '28', '%', '36 to 46', 'Low', 'ba', '31'], ['MCV', '84', 'fL', '80 to 100', 'Normal', 'bg', '85'], ['Neutrophils', '78', '%', '40 to 75', 'High', 'ba', '70'], ['Lymphocytes', '16', '%', '20 to 45', 'Low', 'ba', '24'], ['ESR', '28', 'mm/h', '0 to 20', 'High', 'ba', '-']].map(function (p) { return { n: p[0], v: p[1], u: p[2], r: p[3], f: p[4], fc: p[5], prev: p[6] }; })
    };
  }
