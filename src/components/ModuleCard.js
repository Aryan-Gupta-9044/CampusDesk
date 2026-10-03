import React from "react";
import { Link } from "react-router-dom";

function ModuleCard({ title, description, phase, to, accent = "accent-coral" }) {
  const content = (
    <div className={`module-card ${accent}`}>
      <div className="module-card-top">
        <h3>{title}</h3>
        {phase && <span className="module-phase">{phase}</span>}
      </div>
      <p>{description}</p>
      {to && <span className="text-link">Open →</span>}
    </div>
  );

  return to ? (
    <Link to={to} className="module-card-link">
      {content}
    </Link>
  ) : (
    content
  );
}

export default ModuleCard;
