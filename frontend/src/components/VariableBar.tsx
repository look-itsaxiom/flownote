import { useState } from 'react';

interface VariableBarProps {
  variables: Record<string, unknown>;
}

/**
 * Formats a variable value for display in the variable bar.
 */
function formatVariableValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length}]`;
  }
  if (typeof value === 'object') {
    return '{...}';
  }
  return String(value);
}

/**
 * Recursively renders an object's properties for the expanded view.
 */
function ObjectView({ obj, depth = 0 }: { obj: Record<string, unknown>; depth?: number }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const entries = Object.entries(obj);

  return (
    <div className="object-view" style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
      {entries.map(([key, value]) => {
        const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const isExpanded = expandedKeys.has(key);

        return (
          <div key={key} className="object-view__entry">
            {isObject ? (
              <>
                <button
                  className="object-view__toggle"
                  onClick={() => toggleKey(key)}
                  aria-expanded={isExpanded}
                >
                  <span className="object-view__arrow">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span className="object-view__key">{key}:</span>
                  {!isExpanded && <span className="object-view__preview">{'{...}'}</span>}
                </button>
                {isExpanded && (
                  <ObjectView obj={value as Record<string, unknown>} depth={depth + 1} />
                )}
              </>
            ) : (
              <div className="object-view__item">
                <span className="object-view__key">{key}:</span>
                <span className="object-view__value">{formatVariableValue(value)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * VariableBar displays the current variables in a collapsible panel at the bottom.
 */
export default function VariableBar({ variables }: VariableBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());

  const entries = Object.entries(variables);
  const hasVariables = entries.length > 0;

  const toggleVar = (key: string) => {
    setExpandedVars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className={`variable-bar ${isExpanded ? 'variable-bar--expanded' : ''}`}>
      <button
        className="variable-bar__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="variable-bar__toggle">{isExpanded ? '\u25BE' : '\u25B8'}</span>
        <span className="variable-bar__title">Variables</span>
        {!isExpanded && hasVariables && (
          <span className="variable-bar__summary">
            {entries.map(([key, value]) => (
              <span key={key} className="variable-bar__summary-item">
                <span className="variable-bar__summary-key">{key}:</span>
                <span className="variable-bar__summary-value">{formatVariableValue(value)}</span>
              </span>
            ))}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="variable-bar__content">
          {!hasVariables ? (
            <div className="variable-bar__empty">No variables defined</div>
          ) : (
            <div className="variable-bar__list">
              {entries.map(([key, value]) => {
                const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
                const isVarExpanded = expandedVars.has(key);

                return (
                  <div key={key} className="variable-bar__item">
                    {isObject ? (
                      <>
                        <button
                          className="variable-bar__item-toggle"
                          onClick={() => toggleVar(key)}
                          aria-expanded={isVarExpanded}
                        >
                          <span className="variable-bar__item-arrow">
                            {isVarExpanded ? '\u25BE' : '\u25B8'}
                          </span>
                          <span className="variable-bar__item-key">{key}:</span>
                          {!isVarExpanded && (
                            <span className="variable-bar__item-preview">{'{...}'}</span>
                          )}
                        </button>
                        {isVarExpanded && (
                          <ObjectView obj={value as Record<string, unknown>} depth={1} />
                        )}
                      </>
                    ) : (
                      <div className="variable-bar__item-row">
                        <span className="variable-bar__item-key">{key}:</span>
                        <span className="variable-bar__item-value">{formatVariableValue(value)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
