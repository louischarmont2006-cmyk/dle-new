import './Avatar.css';

export default function Avatar({ user, size = 'md', className = '' }) {
  if (!user) return null;

  const sizeClass = `avatar-${size}`;
  const initial = user.username?.charAt(0).toUpperCase() || '?';

  // Si l'utilisateur a une image d'avatar personnalisée
  if (user.avatar_image) {
    return (
      <div className={`avatar ${sizeClass} ${className}`}>
        <img src={user.avatar_image} alt={user.username} />
      </div>
    );
  }

  // Sinon, afficher l'avatar par défaut (cercle coloré + initiale)
  const bgColor = user.avatar_color || '#3b82f6';

  return (
    <div
      className={`avatar avatar-default ${sizeClass} ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {initial}
    </div>
  );
}
