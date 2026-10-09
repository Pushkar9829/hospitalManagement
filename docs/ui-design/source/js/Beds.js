  renderVals() {
    var sel = (this.state && this.state.sel) || 'W2-204-A';
    var S = { O: ['Occupied', '#FDECEA', 'br'], A: ['Available', '#E3F3EA', 'bg'], R: ['Reserved', '#E6EEF9', 'bb'], D: ['Discharge due', '#FCE9DC', 'bo'], C: ['Cleaning', '#FFF1D6', 'ba'], M: ['Maintenance', '#EEF0F3', 'bn'] };
    var names = ['R. Kumar', 'S. Patil', 'A. Joshi', 'M. Lal', 'F. Ali', 'K. Nair', 'J. Dsouza', 'P. Rao', 'T. Shah', 'N. Iyer', 'H. Singh', 'L. Das'];
    var docs = ['Dr. Meera Iyer', 'Dr. R. Menon', 'Dr. P. Joshi', 'Dr. F. Khan'];
    var W2N = { 0: ['S. Patil', 'Dr. R. Menon', 4], 2: ['A. Joshi', 'Dr. P. Joshi', 5], 4: ['M. Lal', 'Dr. P. Joshi', 6], 5: ['N. Iyer', 'Dr. Meera Iyer', 3], 6: ['F. Ali', 'Dr. R. Menon', 3], 7: ['Ravi Kumar', 'Dr. Meera Iyer', 1], 8: ['K. Nair', 'Dr. R. Menon', 7], 9: ['J. Dsouza', 'Dr. R. Menon', 3], 11: ['P. Rao', 'Dr. R. Menon', 2] };
    var W = [['Ward 2 · Semi-private', 'W2', 'OAOCOOOODOMO'], ['ICU · Floor 3', 'ICU', 'OOOODOOR'], ['Private · Floor 4', 'PVT', 'OAODOCOA']];
    var all = {};
    var wards = W.map((w) => {
      var beds = w[2].split('').map((k, i) => {
        var id = w[1] === 'W2' ? 'W2-20' + (1 + Math.floor(i / 2)) + '-' + (i % 2 ? 'B' : 'A') : w[1] + '-' + (i < 9 ? '0' : '') + (i + 1);
        var occ = k === 'O' || k === 'D';
        var w2 = w[1] === 'W2' ? W2N[i] : null;
        var b = { id: id, s: S[k][0], c: S[k][2], p: occ ? (w2 ? w2[0] : names[i % 12]) : (k === 'R' ? 'Planned 15:00' : '-'), d: occ ? (w2 ? w2[1] : docs[i % 4]) : '-', days: occ ? String(w2 ? w2[2] : 1 + (i % 6)) : '-', cat: w[0].split(' · ')[0] };
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
