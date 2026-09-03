import WindowControls from './WindowControls';

export default function TitleBar({ title = 'PROXY X', onClose }) {
  return (
    <div className="app-title-bar">
      <span className="app-title-bar-text">{title}</span>
      <WindowControls onClose={onClose} />
    </div>
  );
}
