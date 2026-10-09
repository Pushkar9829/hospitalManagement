"""Assemble a hospital-app artboard: python3 build.py Name "Title" "Crumb" "H1" "User" "Role" "Init" "Panel" """
import sys, os
S = os.path.dirname(os.path.abspath(__file__))
name, title, crumb, h1, user, role, init, panel = sys.argv[1:9]
rd = lambda p: open(os.path.join(S, p)).read()
head = rd('parts/head.html').replace('__TITLE__', title)
shell = rd('parts/shell_open.html')
for k, v in [('__CRUMB__', crumb), ('__H1__', h1), ('__USER__', user), ('__ROLE__', role), ('__INIT__', init), ('__PANEL__', panel)]:
    shell = shell.replace(k, v)
body = rd('body/%s.html' % name)
body = body.replace('@@TABS@@', rd('parts/tabs.html').strip()).replace('@@PANEL@@', rd('parts/panel.html').strip())
js = rd('js/%s.js' % name)
tabs_js = os.path.join(S, 'js/%s.tabs.js' % name)
if os.path.exists(tabs_js):
    js = js.replace('  renderVals() {', '  baseVals() {', 1) + open(tabs_js).read() + rd('parts/tabbed_render.js')
out = head + shell + body + rd('parts/tail_open.html') + js + rd('parts/tail_close.html')
open(os.path.join(S, '..', 'boards', '%s.dc.html' % name), 'w').write(out)
print('built', name, out.count('\n'), 'lines')
