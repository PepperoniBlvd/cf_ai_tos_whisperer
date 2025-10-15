import { React } from './lib/react.js';
import { getProfile, saveProfile, analyze } from './api.js';
import { Controls } from './components/Controls.js';
import { Results } from './components/Results.js';

function useProfile() {
  const [profile, setProfile] = React.useState({ privacy: 70, autoRenewals: 30, arbitration: 20 });
  React.useEffect(() => { getProfile().then(p => setProfile(p)).catch(()=>{}); }, []);
  const save = async (p) => { setProfile(p); try { await saveProfile(p); } catch {} };
  return [profile, setProfile, save];
}

export function App() {
  const [profile, setProfile, saveProfileFn] = useProfile();
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function onAnalyze(){
    setLoading(true); setResult(null);
    try{
      const data = await analyze({ tosUrl: url, tosText: text, prefs: profile });
      setResult(data);
    }catch(e){
      setResult({ error: e.message || 'Analyze failed' });
    }finally{
      setLoading(false);
    }
  }

  return React.createElement(React.Fragment, null,
    React.createElement('header', null,
      React.createElement('h1', null, 'ToS Whisperer'),
      React.createElement('div', { className: 'small' }, 'Paste a ToS URL or text. Set your risk tolerance, then analyze.')
    ),
    React.createElement(Controls, {
      url, setUrl, text, setText,
      profile,
      onProfileChange: setProfile,
      onSave: () => saveProfileFn(profile),
      onAnalyze,
    }),
    React.createElement(Results, { result, loading })
  );
}
