import { React, ReactMarkdown } from '../lib/react.js';

export function Results({ result, loading }) {
  if (loading) return React.createElement('div', { className: 'card results' }, 'Analyzing…');
  if (!result) return React.createElement('div', { className: 'card results' });
  if (result.error) return React.createElement('div', { className: 'card results small' }, result.error);

  const top = (result && result.comparison && Array.isArray(result.comparison.top)) ? result.comparison.top : [];

  return React.createElement('div', { className: 'card results' },
    React.createElement('h3', null, 'Highlights'),
    top.map((c, i) => React.createElement('div', { key: i, className: 'card ' + (c.riskScore > 50 ? 'risk' : 'ok') },
      React.createElement('div', { className: 'pill' }, c.tag), ' ',
      React.createElement('strong', null, c.title), ' ',
      React.createElement('span', { className: 'pill' }, 'risk ', c.riskScore),
      React.createElement('div', null, c.snippet)
    )),
    React.createElement('h3', null, 'Summary'),
    React.createElement('div', { className: 'md' }, React.createElement(ReactMarkdown, { children: result.summary || '' }))
  );
}

