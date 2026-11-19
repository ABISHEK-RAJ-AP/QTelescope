import React, { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Field, fieldClass } from '@/components/AuthShell'
import { filterMasterOptions, visibleOrgFields } from '@/data/registerOrgHierarchy'

function SearchableMaster({ field, value, onChange, invalid, disabled }) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const options = field.options || [];
  const filtered = useMemo(() => filterMasterOptions(options, query).slice(0, 80), [options, query]);

  return (
    <div className="reg-master-search">
      <Search className="reg-master-search__icon" aria-hidden />
      <input
        id={field.id}
        type="search"
        list={listId}
        className={`${fieldClass} reg-master-search__input${invalid ? ' auth-field--invalid qt-shake' : ''}`}
        value={query}
        disabled={disabled}
        placeholder={field.placeholder || 'Search or type…'}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (query !== value) onChange(query);
        }}
      />
      <datalist id={listId}>
        {filtered.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}

export function RegisterOrgFields({
  typeId,
  values,
  onChange,
  fieldErrors = {},
  disabled = false,
}) {
  const fields = visibleOrgFields(typeId, values);

  return (
    <div className="reg-org-detail">
      {fields.map((field) => {
        const err = fieldErrors[field.id];
        const value = values[field.id] || '';

        if (field.kind === 'select') {
          return (
            <Field key={field.id} label={field.label} forId={`reg-org-${field.id}`} hint={err}>
              <select
                id={`reg-org-${field.id}`}
                className={`${fieldClass} reg-org-select${err ? ' auth-field--invalid qt-shake' : ''}`}
                value={value}
                disabled={disabled}
                required={field.required}
                onChange={(e) => onChange(field.id, e.target.value)}
              >
                <option value="">Select…</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
          );
        }

        if (field.kind === 'search') {
          return (
            <Field key={field.id} label={field.label} forId={`reg-org-${field.id}`} hint={err}>
              <SearchableMaster
                field={{ ...field, id: `reg-org-${field.id}` }}
                value={value}
                invalid={Boolean(err)}
                disabled={disabled}
                onChange={(v) => onChange(field.id, v)}
              />
            </Field>
          );
        }

        return (
          <Field key={field.id} label={field.label} forId={`reg-org-${field.id}`} hint={err}>
            <input
              id={`reg-org-${field.id}`}
              type="text"
              className={`${fieldClass}${err ? ' auth-field--invalid qt-shake' : ''}`}
              value={value}
              disabled={disabled}
              required={field.required}
              placeholder={field.placeholder}
              autoComplete="organization"
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          </Field>
        );
      })}
      {fieldErrors._org ? <p className="auth-field-error">{fieldErrors._org}</p> : null}
    </div>
  );
}