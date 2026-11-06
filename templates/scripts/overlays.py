import json, re, sys
W=json.load(open(sys.argv[1])); html_path=sys.argv[2]; D=float(sys.argv[3])
norm=lambda w: re.sub(r'[^a-z0-9]','',w.lower())
def at(word, n=1):
    k=0
    for w in W:
        if norm(w['w'])==word:
            k+=1
            if k==n: return w['s']
    raise SystemExit('no word '+word)
# ---- captions: chunks of up to 3 words / 18 chars, break after punctuation
chunks=[]; cur=[]
for i,w in enumerate(W):
    cur.append(w); txt=' '.join(x['w'] for x in cur)
    nxt=W[i+1] if i+1<len(W) else None
    brk = w['w'][-1] in '.,?!:' or len(cur)>=3 or len(txt)>=16 or (nxt and nxt['s']-w['e']>0.35)
    if nxt and len(txt+' '+nxt['w'])>20: brk=True
    if brk or not nxt: chunks.append(cur); cur=[]
KEY={'eiffel','tower','scrap','1925','7000','vienna','bribe','police','again','fortune','secret','six','cash','lustig','poisson','andr','victor','luck','rush','humiliated'}
out=[]; tw=[]
SKIP={'victor','1925','7000'}
for k,c in enumerate(chunks):
    if any(norm(w['w']) in SKIP or norm(w['w']).startswith('andr') for w in c): continue
    s0=max(0,c[0]['s']-0.08); e0=chunks[k+1][0]['s']-0.08 if k+1<len(chunks) else min(D, c[-1]['e']+0.6)
    e0=min(e0, c[-1]['e']+0.9)
    if e0-s0<0.12: e0=s0+0.12
    words=[]
    for w in c:
        t=w['w'].replace('"','').replace('“','').replace('”','')
        cls='kw' if norm(w['w']) in KEY or norm(w['w']).startswith('andr') else ''
        words.append(f'<span class="w {cls}">{t}</span>')
    cid=f'cap{k:03d}'
    out.append(f'<div id="{cid}" class="clip cap" data-start="{s0:.3f}" data-duration="{e0-s0:.3f}" data-track-index="5"><div class="cin">{" ".join(words)}</div></div>')
    tw.append(f'tl.fromTo("#{cid} .cin",{{y:22,opacity:0}},{{y:0,opacity:1,duration:0.13,ease:"power2.out",immediateRender:false}},{s0:.3f});')
# ---- graphic overlays
def clip(id_, s0, dur, inner, track=6): return f'<div id="{id_}" class="clip ov" data-start="{s0:.3f}" data-duration="{dur:.3f}" data-track-index="{track}">{inner}</div>'
g=[]; gt=[]
tp=at('paris'); tr=at('rusting')
g.append(clip('year', tp-0.05, tr-tp+0.35, '<div class="year"><div class="ymask"><div class="yl">PARIS</div></div><div class="ymask"><div class="yn">1925</div></div></div>'))
gt.append(f'tl.fromTo("#year .yl",{{yPercent:150}},{{yPercent:0,duration:0.45,ease:"expo.out",immediateRender:false}},{tp-0.05:.3f}); tl.fromTo("#year .yn",{{yPercent:150}},{{yPercent:0,duration:0.5,ease:"expo.out",immediateRender:false}},{tp+0.12:.3f}); tl.to("#year .year",{{y:-30,opacity:0,duration:0.25,ease:"power2.in"}},{tr+0.08:.3f});')
def badge(id_, t0, dur, name, role, top):
    g.append(clip(id_, t0-0.1, dur, f'<div class="badge" style="top:{top}px"><div class="pin"></div><div class="bn">{name}</div><div class="br">{role}</div></div>'))
    gt.append(f'tl.fromTo("#{id_} .badge",{{scale:0.55,rotation:-9,opacity:0}},{{scale:1,rotation:-3,opacity:1,duration:0.42,ease:"back.out(2.2)",immediateRender:false}},{t0-0.1:.3f}); tl.to("#{id_} .badge",{{y:-24,opacity:0,duration:0.22,ease:"power2.in"}},{t0-0.1+dur-0.24:.3f});')
badge('bLustig', at('victor'), 1.55, 'VICTOR LUSTIG', 'CON MAN', 300)
badge('bPoisson', at('andr') if any(norm(w['w']).startswith('andr') and norm(w['w'])=='andr' for w in W) else [w['s'] for w in W if norm(w['w']).startswith('andr')][0], 2.5, 'ANDRÉ POISSON', 'SCRAP METAL DEALER', 300)
tt=[w['s'] for w in W if norm(w['w']) in ('7000','seven')][0]
g.append(clip('tons', tt-0.05, 1.9, '<div class="tons"><div class="tn">7,000</div><div class="tl2">TONS OF IRON</div></div>'))
gt.append(f'tl.fromTo("#tons .tons",{{scale:0.4,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(2.6)",immediateRender:false}},{tt-0.05:.3f}); tl.to("#tons .tons",{{opacity:0,y:-20,duration:0.2}},{tt+1.62:.3f});')
tv=at('vienna')
g.append(clip('vienna', tv-0.15, 2.0, '<div class="ticket"><span class="from">PARIS</span><span class="arr">→</span><span class="to">VIENNA</span></div>'))
gt.append(f'tl.fromTo("#vienna .ticket",{{x:-120,opacity:0,rotation:-6}},{{x:0,opacity:1,rotation:-3,duration:0.45,ease:"expo.out",immediateRender:false}},{tv-0.15:.3f}); tl.to("#vienna .ticket",{{x:120,opacity:0,duration:0.25,ease:"power2.in"}},{tv+1.6:.3f});')
css='''
<style>
  .cap, .ov { position:absolute; inset:0; pointer-events:none; }
  .cap { z-index:20; } .ov { z-index:21; }
  .cin { position:absolute; left:160px; width:760px; top:1250px; text-align:center; font-family:"Archivo Black", sans-serif; font-size:74px; line-height:1.05; color:#fff;
         -webkit-text-stroke:11px #241726; paint-order:stroke fill; filter:drop-shadow(0 6px 0 rgba(36,23,38,0.55)) drop-shadow(0 14px 24px rgba(0,0,0,0.35)); letter-spacing:0.5px; }
  .cin .w { display:inline-block; margin:0 5px; } .cin .kw { font-size:96px; }
  .year { position:absolute; left:0; width:1080px; top:290px; text-align:center; font-family:"Archivo Black", sans-serif; color:#fff; -webkit-text-stroke:12px #241726; paint-order:stroke fill;
          filter:drop-shadow(0 8px 0 rgba(36,23,38,0.5)); }
  .ymask { overflow:hidden; padding:14px 0 10px; margin:-14px 0 -10px; }
  .yl { font-size:64px; letter-spacing:22px; padding-left:22px; } .yn { font-size:190px; line-height:1; color:#ffd36a; }
  .badge { position:absolute; left:190px; width:700px; padding:26px 30px 22px; background:#f6efe0; border:7px solid #241726; border-radius:22px; box-shadow:0 10px 0 rgba(36,23,38,0.55);
           text-align:center; transform-origin:50% 0; }
  .badge .pin { position:absolute; left:50%; top:-22px; width:34px; height:34px; margin-left:-17px; border-radius:50%; background:#c62f2a; border:6px solid #241726; }
  .bn { font-family:"Archivo Black", sans-serif; font-size:62px; color:#241726; line-height:1.05; }
  .br { margin-top:8px; font-family:"Montserrat", sans-serif; font-weight:800; font-size:30px; letter-spacing:7px; color:#c62f2a; }
  .tons { position:absolute; left:0; width:1080px; top:300px; text-align:center; font-family:"Archivo Black", sans-serif; color:#ffd36a; -webkit-text-stroke:12px #241726; paint-order:stroke fill;
          filter:drop-shadow(0 8px 0 rgba(36,23,38,0.5)); }
  .tn { font-size:200px; line-height:1; } .tl2 { font-size:56px; color:#fff; letter-spacing:4px; }
  .ticket { position:absolute; left:200px; width:680px; top:310px; padding:22px 0; background:#f6efe0; border:7px dashed #241726; border-radius:18px; text-align:center;
            font-family:"Archivo Black", sans-serif; font-size:64px; color:#241726; box-shadow:0 10px 0 rgba(36,23,38,0.5); }
  .ticket .arr { color:#c62f2a; margin:0 18px; }
</style>'''
h=open(html_path).read()
h=re.sub(r'<!-- OVERLAYS -->.*?<!-- /OVERLAYS -->','',h,flags=re.S)
h=re.sub(r'// OVTWEENS.*?// /OVTWEENS\n','',h,flags=re.S)
h=h.replace('</head>', '' if 'class="cin"' in css and '.cin {' in h else css+'\n</head>') if '.cin {' not in h else h
h=h.replace('      <!--\n        Add your clips here.', '      <!-- OVERLAYS -->\n'+'\n'.join(out+g)+'\n      <!-- /OVERLAYS -->\n      <!--\n        Add your clips here.')
h=h.replace('      window.__timelines["main"] = tl;','      // OVTWEENS\n      '+'\n      '.join(tw+gt)+'\n      // /OVTWEENS\n      window.__timelines["main"] = tl;')
open(html_path,'w').write(h); print(len(chunks),'caption chunks;', len(g),'overlays')
