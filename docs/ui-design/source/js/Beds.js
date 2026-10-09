  renderVals() {
    var sel = (this.state && this.state.sel) || 'W2-204-A';
    var S = { O: ['Occupied', '#FDECEA', 'br'], A: ['Available', '#E3F3EA', 'bg'], R: ['Reserved', '#E6EEF9', 'bb'], D: ['Discharge due', '#FCE9DC', 'bo'], C: ['Cleaning', '#FFF1D6', 'ba'], M: ['Maintenance', '#EEF0F3', 'bn'] };
    var names = ['R. Kumar', 'S. Patil', 'A. Joshi', 'M. Lal', 'F. Ali', 'K. Nair', 'J. Dsouza', 'P. Rao', 'T. Shah', 'N. Iyer', 'H. Singh', 'L. Das'];
    var docs = ['Dr. Meera Iyer', 'Dr. R. Menon', 'Dr. P. Joshi', 'Dr. F. Khan'];
    var W = [['Ward 2 · Semi-private', 'W2', 'OAOCAROADOMA'], ['ICU · Floor 3', 'ICU', 'OOOODOOR'], ['Private · Floor 4', 'PVT', 'OAODOCOA']];
    var all = {};
    var wards = W.map((w) => {
      var beds = w[2].split('').map((k, i) => {
        var id = w[1] === 'W2' ? 'W2-20' + (1 + Math.floor(i / 2)) + '-' + (i % 2 ? 'B' : 'A') : w[1] + '-' + (i < 9 ? '0' : '') + (i + 1);
        var occ = k === 'O' || k === 'D';
        var b = { id: id, s: S[k][0], c: S[k][2], p: occ ? names[i % 12] : (k === 'R' ? 'Planned 15:00' : '-'), d: occ ? docs[i % 4] : '-', days: occ ? String(1 + (i % 6)) : '-', cat: w[0].split(' · ')[0] };
        all[id] = b;
        return { id: id, s: b.s, p: b.p, bg: S[k][1], bd: id === sel ? '#1F5FAD' : 'transparent', pick: () => this.setState({ sel: id }) };
      });
      var occN = w[2].split('').filter(function (k) { return k === 'O' || k === 'D'; }).length;
      return { n: w[0], o: occN + ' of ' + w[2].length + ' occupied', beds: beds };
    });
    return {
      nav: this.navItems('Beds'), wards: wards, sel: all[sel] || all['W2-204-A'],
      kpis: [{ l: 'Total beds', v: '120' }, { l: 'Occupied', v: '103' }, { l: 'Available', v: '9' }, { l: 'Reserved', v: '3' }, { l: 'Cleaning', v: '3' }, { l: 'Discharges due', v: '6' }]
    };
  }
