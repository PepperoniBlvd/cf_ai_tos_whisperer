// Use esm.sh with deps=react@18 so no bare specifiers like "react" remain
import React from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client?deps=react@18';
import ReactMarkdown from 'https://esm.sh/react-markdown@9?deps=react@18';

const API_BASE = (location.hostname.endsWith('.workers.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? ''
  : 'https://cf_ai_tos_whisperer.zhenao-li.workers.dev';

function useProfile() {
  const [profile, setProfile] = React.useState({ privacy: 70, autoRenewals: 30, arbitration: 20 });
  React.useEffect(() => { fetch(API_BASE + '/api/profile').then(r=>r.ok?r.json():null).then(p=>{ if(p) setProfile(p); }); }, []);
  const save = async (p) => { setProfile(p); await fetch(API_BASE + '/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}); };
  return [profile, save];
}

function App(){
  const [profile, saveProfile] = useProfile();
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function analyze(){
    setLoading(true); setResult(null);
    try{
      const res = await fetch(API_BASE + '/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ tosUrl: url||undefined, tosText: text||undefined, prefs: profile })});
      if(!res.ok) throw new Error('Analyze failed');
      const data = await res.json();
      setResult(data);
    }catch(e){
      setResult({ error: e.message });
    }finally{
      setLoading(false);
    }
  }

  const top = (result && result.comparison && Array.isArray(result.comparison.top)) ? result.comparison.top : [];

  return (
    React.createElement('div', null,
      React.createElement('header', null,
        React.createElement('h1', null, 'ToS Whisperer'),
        React.createElement('div', {className:'small'}, 'Paste a ToS URL or text. Set your risk tolerance, then analyze.')
      ),
      React.createElement('div', {className:'card'},
        React.createElement('div', {className:'row'},
          React.createElement('div', null,
            React.createElement('label', null, 'Terms of Service URL'),
            React.createElement('input', {type:'url', placeholder:'https://example.com/terms', value:url, onChange:e=>setUrl(e.target.value)}),
            React.createElement('div', {className:'small'}, 'or paste text below')
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Dictate (optional)'),
            React.createElement('button', {onClick:()=>{}}, '🎤 Start/Stop'),
            React.createElement('div', {className:'small', id:'micStatus'})
          )
        ),
        React.createElement('label', null, 'Terms of Service Text'),
        React.createElement('textarea', {rows:10, placeholder:'Paste ToS text here...', value:text, onChange:e=>setText(e.target.value)})
      ),
      React.createElement('div', {className:'card'},
        React.createElement('h3', null, 'Risk Tolerance'),
        React.createElement('div', {className:'grid'},
          React.createElement('div', null,
            React.createElement('label', null, 'Privacy & Data Sharing: ', React.createElement('span', null, profile.privacy)),
            React.createElement('input', {type:'range', min:0, max:100, value:profile.privacy, onChange:e=>saveProfile({...profile, privacy:+e.target.value})}),
            React.createElement('div', {className:'small'}, 'Higher = more tolerant of data collection/sharing')
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Auto-Renewals: ', React.createElement('span', null, profile.autoRenewals)),
            React.createElement('input', {type:'range', min:0, max:100, value:profile.autoRenewals, onChange:e=>saveProfile({...profile, autoRenewals:+e.target.value})}),
            React.createElement('div', {className:'small'}, 'Higher = more tolerant of auto-renewals')
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Mandatory Arbitration: ', React.createElement('span', null, profile.arbitration)),
            React.createElement('input', {type:'range', min:0, max:100, value:profile.arbitration, onChange:e=>saveProfile({...profile, arbitration:+e.target.value})}),
            React.createElement('div', {className:'small'}, 'Higher = more tolerant of arbitration clauses')
          )
        ),
        React.createElement('div', {style:{marginTop:12}},
          React.createElement('button', {onClick:()=>saveProfile(profile)}, 'Save Preferences'),
          React.createElement('button', {onClick:analyze, style:{marginLeft:8}}, 'Analyze ToS')
        )
      ),
      React.createElement('div', {className:'card results'},
        loading ? 'Analyzing…' : (
          result ? (
            result.error ? React.createElement('div', {className:'small'}, result.error) : (
              React.createElement(React.Fragment, null,
                React.createElement('h3', null, 'Highlights'),
                top.map((c, i)=> React.createElement('div', {key:i, className:'card ' + (c.riskScore>50?'risk':'ok')},
                  React.createElement('div', {className:'pill'}, c.tag), ' ',
                  React.createElement('strong', null, c.title), ' ',
                  React.createElement('span', {className:'pill'}, 'risk ', c.riskScore),
                  React.createElement('div', null, c.snippet)
                )),
                React.createElement('h3', null, 'Summary'),
                React.createElement('div', {className:'md'}, React.createElement(ReactMarkdown, {children: result.summary || ''}))
              )
            )
          ) : null
        )
      )
    )
  );
}

createRoot(document.getElementById('root')).render(React.createElement(App));
