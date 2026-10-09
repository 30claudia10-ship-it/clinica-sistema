#!/usr/bin/env python3
"""Gera css/tokens.css a partir de tokens.json. Uso (dentro de plena-site/): python3 tools/gerar-tokens.py"""
import json
t=json.load(open('tokens.json'))
toks=t['color']['tokens']
def val(v,th):
    return v[th] if isinstance(v,dict) else 'var(--%s)'%v.strip('{}')
def block(th):
    return '\n'.join('  --%s:%s;'%(x['name'],val(x['value'],th)) for x in toks if not x['name'].startswith('status-'))
sp='\n'.join('  --%s:%s;'%(x['name'],x['value']) for x in t['spacing']['tokens'])
rd='\n'.join('  --%s:%s;'%(x['name'],x['value']) for x in t['radius']['tokens'])
sh=lambda th:'  --sombra-suave:%s;'%t['shadow']['tokens'][0]['value'][th]
ff=''.join('@font-face{font-family:"%s";src:url("../assets/fonts/%s") format("woff2");font-weight:%s;font-style:%s;font-display:swap}\n'%(f['family'],f['file'].split('/')[1],f['weight'],f.get('style','normal')) for f in t['type']['fonts'])
open('css/tokens.css','w').write(f"""/* GERADO por tools/gerar-tokens.py a partir de tokens.json. Não edite à mão. */
{ff}
:root{{
  color-scheme: light;
{block('light')}
{sp}
{rd}
{sh('light')}
  --fonte-titulo:{t['type']['families']['display']};
  --fonte-texto:{t['type']['families']['sans']};
}}
@media (prefers-color-scheme: dark){{
  :root:not([data-tema="claro"]){{
    color-scheme: dark;
{block('dark')}
{sh('dark')}
  }}
}}
:root[data-tema="escuro"]{{
  color-scheme: dark;
{block('dark')}
{sh('dark')}
}}
""")
