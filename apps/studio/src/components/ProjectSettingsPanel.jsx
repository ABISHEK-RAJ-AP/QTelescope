import { useEffect, useState } from 'react';
import { fetchProjectSettingsSchema, patchProject } from '../api.js';

function fieldValue(settings, path) {
  let cur = settings;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function SchemaField({ name, schema, value, onChange, disabled }) {
  const title = schema.title || name;
  if (schema.enum) {
    return (
      <label className="qre-field">
        <span className="qre-field__label">{title}</span>
        <select
          className="qre-field__input"
          disabled={disabled}
          value={value ?? schema.default ?? schema.enum[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {schema.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (schema.type === 'boolean') {
    return (
      <label className="qre-field qre-field--row">
        <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="qre-field__label">{title}</span>
      </label>
    );
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return (
      <label className="qre-field">
        <span className="qre-field__label">{title}</span>
        <input
          type="number"
          className="qre-field__input"
          disabled={disabled}
          min={schema.minimum}
          max={schema.maximum}
          value={value ?? schema.default ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </label>
    );
  }
  return null;
}

function Section({ sectionKey, sectionSchema, settings, onPatch, disabled }) {
  const props = sectionSchema.properties || {};
  if (!Object.keys(props).length) return null;
  return (
    <fieldset className="qre-settings-section" disabled={disabled}>
      <legend>{sectionSchema.title || sectionKey}</legend>
      {Object.entries(props).map(([fieldKey, fieldSchema]) => (
        <SchemaField
          key={fieldKey}
          name={fieldKey}
          schema={fieldSchema}
          value={fieldValue(settings, [sectionKey, fieldKey])}
          onChange={(v) => onPatch(sectionKey, fieldKey, v)}
          disabled={disabled}
        />
      ))}
    </fieldset>
  );
}

export default function ProjectSettingsPanel({ projectId, settings, locked, onUpdated, compact = false }) {
  const [schemaDoc, setSchemaDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchProjectSettingsSchema(projectId)
      .then(setSchemaDoc)
      .catch((e) => setErr(String(e)));
  }, [projectId]);

  async function onPatch(section, field, value) {
    if (locked) return;
    setSaving(true);
    setErr('');
    try {
      const next = await patchProject(projectId, {
        settings: { [section]: { [field]: value } },
      });
      onUpdated(next);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  const platformSchema = schemaDoc?.platform_settings_schema;
  const sections = platformSchema?.properties || {};

  const inner = (
    <>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', margin: 0 }}>Project settings</h2>
          {saving && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Saving…</span>}
        </div>
      )}
      {compact && saving && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 8px' }}>Saving…</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{err}</p>}
      {Object.entries(sections).map(([key, sec]) => (
        <Section
          key={key}
          sectionKey={key}
          sectionSchema={sec}
          settings={settings || schemaDoc?.effective_settings || {}}
          onPatch={onPatch}
          disabled={!!locked}
        />
      ))}
      {!Object.keys(sections).length && (
        <pre style={{ fontSize: 'var(--text-xs)', overflow: 'auto' }}>{JSON.stringify(settings, null, 2)}</pre>
      )}
    </>
  );

  if (compact) return <div className="qre-studio-settings-compact">{inner}</div>;
  return <div className="qre-card">{inner}</div>;
}
