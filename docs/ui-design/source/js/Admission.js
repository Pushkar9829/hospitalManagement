  renderVals() {
    var st = this.state || {};
    var step = st.step || 2, bed = st.bed || 'W2-204-B';
    var L = ['Patient', 'Bed', 'Payer and attendant', 'Deposit', 'Consent'];
    var B = [['W2-201-A', 'Occupied'], ['W2-201-B', 'Available'], ['W2-202-A', 'Occupied'], ['W2-202-B', 'Cleaning'], ['W2-203-A', 'Available'], ['W2-203-B', 'Reserved'],
      ['W2-204-A', 'Occupied'], ['W2-204-B', 'Available'], ['W2-205-A', 'Discharge due'], ['W2-205-B', 'Occupied'], ['W2-206-A', 'Maintenance'], ['W2-206-B', 'Available']];
    var C = { 'Available': '#E3F3EA', 'Occupied': '#FDECEA', 'Cleaning': '#FFF1D6', 'Reserved': '#E6EEF9', 'Discharge due': '#FCE9DC', 'Maintenance': '#EEF0F3' };
    return {
      nav: this.navItems('Admission'), bed: bed,
      steps: L.map((l, i) => ({ n: i + 1, l: l, bg: i + 1 === step ? '#E6EEF9' : (i + 1 < step ? '#F3FAF6' : '#fff'), bd: i + 1 === step ? '#1F5FAD' : '#DDE2E8', go: () => this.setState({ step: i + 1 }) })),
      s1: step === 1, s2: step === 2, s3: step === 3, s4: step === 4, s5: step === 5,
      beds: B.map((b) => ({ id: b[0], s: b[0] === bed ? 'Selected' : b[1], bg: b[0] === bed ? '#D6E4F7' : C[b[1]], bd: b[0] === bed ? '#1F5FAD' : 'transparent', dis: b[1] !== 'Available', pick: () => this.setState({ bed: b[0] }) })),
      next: () => this.setState({ step: Math.min(5, step + 1) }), prev: () => this.setState({ step: Math.max(1, step - 1) })
    };
  }
