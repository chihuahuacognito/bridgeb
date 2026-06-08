export function PanelCard({ title }) {
  const card = document.createElement('div');
  card.className = 'panel-card';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = title.toUpperCase();

  const body = document.createElement('div');
  body.className = 'panel-body';

  card.append(header, body);
  card.body = body;
  return card;
}
