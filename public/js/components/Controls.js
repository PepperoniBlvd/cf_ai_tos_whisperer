import { React } from '../lib/react.js';

export function Controls({ url, setUrl, text, setText, profile, onProfileChange, onSave, onAnalyze }) {
  return React.createElement('div', null,
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'row' },
        React.createElement('div', null,
          React.createElement('label', null, 'Terms of Service URL'),
          React.createElement('input', { type: 'url', placeholder: 'https://example.com/terms', value: url, onChange: e => setUrl(e.target.value) }),
          React.createElement('div', { className: 'small' }, 'or paste text below')
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Dictate (optional)'),
          React.createElement('button', { onClick: () => { } }, '🎤 Start/Stop'),
          React.createElement('div', { className: 'small', id: 'micStatus' })
        )
      ),
      React.createElement('label', null, 'Terms of Service Text'),
      React.createElement('textarea', { rows: 10, placeholder: 'Paste ToS text here...', value: text, onChange: e => setText(e.target.value) })
    ),
    React.createElement('div', { className: 'card' },
      React.createElement('h3', null, 'Risk Tolerance'),
      React.createElement('div', { className: 'grid' },
        React.createElement('div', null,
          React.createElement('label', null, 'Privacy & Data Sharing: ', React.createElement('span', null, profile.privacy)),
          React.createElement('input', { type: 'range', min: 0, max: 100, value: profile.privacy, onChange: e => onProfileChange({ ...profile, privacy: +e.target.value }) }),
          React.createElement('div', { className: 'small' }, 'Higher = more tolerant of data collection/sharing')
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Auto-Renewals: ', React.createElement('span', null, profile.autoRenewals)),
          React.createElement('input', { type: 'range', min: 0, max: 100, value: profile.autoRenewals, onChange: e => onProfileChange({ ...profile, autoRenewals: +e.target.value }) }),
          React.createElement('div', { className: 'small' }, 'Higher = more tolerant of auto-renewals')
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Mandatory Arbitration: ', React.createElement('span', null, profile.arbitration)),
          React.createElement('input', { type: 'range', min: 0, max: 100, value: profile.arbitration, onChange: e => onProfileChange({ ...profile, arbitration: +e.target.value }) }),
          React.createElement('div', { className: 'small' }, 'Higher = more tolerant of arbitration clauses')
        )
      ),
      React.createElement('div', { style: { marginTop: 12 } },
        React.createElement('button', { onClick: onSave }, 'Save Preferences'),
        React.createElement('button', { onClick: onAnalyze, style: { marginLeft: 8 } }, 'Analyze ToS')
      )
    )
  );
}

