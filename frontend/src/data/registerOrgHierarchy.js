/**
 * Registration organisation model: top-level tiles + per-type field masters (Cert Studio pattern).
 * Stored org string: "<Tile label> · <segment> · <segment> …"
 */

export const REGISTER_ORG_TILES = [
  { id: 'government', label: 'Government', hint: 'Central, state, PSU, or national lab', icon: 'Landmark' },
  { id: 'university', label: 'University', hint: 'Academic institutions and campuses', icon: 'GraduationCap' },
  { id: 'private', label: 'Private enterprise', hint: 'Industry and commercial operators', icon: 'Building2' },
  { id: 'research', label: 'Research lab', hint: 'Dedicated R&D facilities', icon: 'FlaskConical' },
  { id: 'national_programme', label: 'National programme', hint: 'Missions, consortia, funded programmes', icon: 'Network' },
  { id: 'startup', label: 'Startup', hint: 'Early-stage commercial teams', icon: 'Rocket' },
  { id: 'international', label: 'International', hint: 'Foreign agencies and institutions', icon: 'Globe2' },
  { id: 'ngo', label: 'NGO / non-profit', hint: 'Foundations and civil society', icon: 'HeartHandshake' },
  { id: 'other', label: 'Other', hint: 'Describe your organisation on the next step', icon: 'Layers', isOther: true },
];

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/** Union ministries & major departments (searchable master). */
export const UNION_MINISTRIES = [
  'Ministry of Agriculture and Farmers Welfare',
  'Ministry of Atomic Energy (DAE)',
  'Ministry of Chemicals and Fertilizers',
  'Ministry of Civil Aviation',
  'Ministry of Coal',
  'Ministry of Commerce and Industry',
  'Ministry of Communications',
  'Ministry of Consumer Affairs, Food and Public Distribution',
  'Ministry of Cooperation',
  'Ministry of Corporate Affairs',
  'Ministry of Culture',
  'Ministry of Defence',
  'Ministry of Earth Sciences',
  'Ministry of Education',
  'Ministry of Electronics and Information Technology (MeitY)',
  'Ministry of Environment, Forest and Climate Change',
  'Ministry of External Affairs',
  'Ministry of Finance',
  'Ministry of Fisheries, Animal Husbandry and Dairying',
  'Ministry of Food Processing Industries',
  'Ministry of Health and Family Welfare',
  'Ministry of Heavy Industries',
  'Ministry of Home Affairs',
  'Ministry of Housing and Urban Affairs',
  'Ministry of Information and Broadcasting',
  'Ministry of Jal Shakti',
  'Ministry of Labour and Employment',
  'Ministry of Law and Justice',
  'Ministry of Ayush',
  'Ministry of Development of North Eastern Region (MDoNER)',
  'Ministry of Micro, Small and Medium Enterprises',
  'Ministry of Mines',
  'Ministry of Minority Affairs',
  'Ministry of New and Renewable Energy',
  'Ministry of Panchayati Raj',
  'Ministry of Parliamentary Affairs',
  'Ministry of Personnel, Public Grievances and Pensions',
  'Ministry of Petroleum and Natural Gas',
  'Ministry of Power',
  'Ministry of Railways',
  'Ministry of Road Transport and Highways',
  'Ministry of Rural Development',
  'Ministry of Science and Technology (DST)',
  'Ministry of Ports, Shipping and Waterways',
  'Ministry of Skill Development and Entrepreneurship',
  'Ministry of Social Justice and Empowerment',
  'Ministry of Statistics and Programme Implementation',
  'Ministry of Steel',
  'Ministry of Textiles',
  'Ministry of Tourism',
  'Ministry of Tribal Affairs',
  'Ministry of Women and Child Development',
  'Ministry of Youth Affairs and Sports',
  'Department of Space (ISRO)',
  'Cabinet Secretariat',
  'NITI Aayog',
  'Prime Minister\'s Office',
];

export const STATE_GOVERNMENT_DEPARTMENTS = [
  'Department of Higher Education',
  'Department of School Education',
  'Department of Information Technology & Electronics',
  'Department of Science & Technology',
  'Department of Industries & Commerce',
  'Department of Energy / Power',
  'Department of Health & Family Welfare',
  'Planning & Development Department',
  'Finance Department',
  'General Administration Department',
];

export const CDAC_SITES = [
  'C-DAC (HQ)',
  'C-DAC Pune',
  'C-DAC Bengaluru',
  'C-DAC Kolkata',
  'C-DAC Mumbai',
  'C-DAC Thiruvananthapuram',
  'C-DAC Hyderabad',
  'C-DAC Patna',
  'C-DAC Noida',
];

export const NATIONAL_LABS_AND_PSUS = [
  'BARC', 'RRCAT', 'VECC', 'IGCAR', 'Variable Energy Cyclotron Centre',
  'National Physical Laboratory (NPL)', 'CSIR — constituent lab',
  'DRDO laboratory', 'ISRO centre', 'DAE unit',
  'BHEL', 'HAL', 'BEL', 'NTPC', 'Power Grid', 'BSNL',
];

export const UNIVERSITY_TIERS = [
  'IIT', 'NIT', 'IISER', 'IIIT', 'Central university', 'State university',
  'Deemed university', 'Private university', 'International university',
];

export const UNIVERSITY_INSTITUTIONS = [
  'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'IIT Kanpur', 'IIT Kharagpur', 'IIT Roorkee',
  'IIT Hyderabad', 'IIT Gandhinagar', 'IIT Indore', 'IIT (ISM) Dhanbad',
  'IISc Bengaluru', 'IISER Pune', 'IISER Kolkata', 'IISER Mohali', 'IISER Thiruvananthapuram',
  'TIFR', 'HRI', 'IMSc', 'HBCSE', 'IUCAA',
  'Anna University', 'University of Delhi', 'Jawaharlal Nehru University', 'Banaras Hindu University',
];

export const PRIVATE_SECTORS = [
  'Technology & software', 'Telecommunications', 'Financial services', 'Manufacturing',
  'Consulting & IT services', 'Energy & utilities', 'Other industry',
];

const GOVERNMENT_FIELDS = [
  {
    id: 'gov_scope',
    label: 'Government level',
    kind: 'select',
    required: true,
    options: [
      'Central government',
      'State government',
      'Union territory administration',
      'Public sector undertaking',
      'Autonomous body / national lab',
    ],
  },
  {
    id: 'state',
    label: 'State or UT',
    kind: 'search',
    required: true,
    options: INDIAN_STATES_AND_UTS,
    showWhen: { field: 'gov_scope', in: ['State government', 'Union territory administration'] },
  },
  {
    id: 'ministry',
    label: 'Ministry',
    kind: 'search',
    required: true,
    options: UNION_MINISTRIES,
    showWhen: { field: 'gov_scope', in: ['Central government'] },
  },
  {
    id: 'state_department',
    label: 'Department',
    kind: 'search',
    required: true,
    options: STATE_GOVERNMENT_DEPARTMENTS,
    showWhen: { field: 'gov_scope', in: ['State government', 'Union territory administration'] },
  },
  {
    id: 'psu_or_lab',
    label: 'Organisation',
    kind: 'search',
    required: true,
    options: [...NATIONAL_LABS_AND_PSUS, ...CDAC_SITES],
    placeholder: 'Select or type organisation name',
    showWhen: { field: 'gov_scope', in: ['Public sector undertaking', 'Autonomous body / national lab'] },
  },
  {
    id: 'department',
    label: 'Department or agency',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Quantum technologies cell',
    showWhen: { field: 'gov_scope', in: ['Central government', 'State government', 'Union territory administration'] },
  },
  {
    id: 'branch',
    label: 'Branch or regional office',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Regional centre, field unit',
  },
  {
    id: 'facility',
    label: 'Facility or programme',
    kind: 'text',
    required: true,
    placeholder: 'e.g. QPU testbed, national mission unit',
  },
];

const UNIVERSITY_FIELDS = [
  {
    id: 'uni_tier',
    label: 'Institution type',
    kind: 'select',
    required: true,
    options: UNIVERSITY_TIERS,
  },
  {
    id: 'institution',
    label: 'Institution',
    kind: 'search',
    required: true,
    options: UNIVERSITY_INSTITUTIONS,
    placeholder: 'Select or type institution name',
  },
  {
    id: 'school',
    label: 'School or department',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Department of Physics',
  },
  {
    id: 'branch',
    label: 'Campus or branch',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Main campus, extension centre',
  },
  {
    id: 'facility',
    label: 'Lab or programme',
    kind: 'text',
    required: true,
    placeholder: 'e.g. Quantum computing lab',
  },
];

const PRIVATE_FIELDS = [
  {
    id: 'sector',
    label: 'Industry',
    kind: 'select',
    required: true,
    options: PRIVATE_SECTORS,
  },
  {
    id: 'organisation',
    label: 'Organisation name',
    kind: 'text',
    required: true,
    placeholder: 'Legal or trading name',
  },
  {
    id: 'division',
    label: 'Division or business unit',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Advanced computing group',
  },
  {
    id: 'branch',
    label: 'Site or office',
    kind: 'text',
    required: false,
    placeholder: 'e.g. Bengaluru R&D centre',
  },
  {
    id: 'facility',
    label: 'Facility or programme',
    kind: 'text',
    required: true,
    placeholder: 'e.g. Quantum pilot programme',
  },
];

const RESEARCH_FIELDS = [
  {
    id: 'lab_class',
    label: 'Lab affiliation',
    kind: 'select',
    required: true,
    options: ['Government lab', 'University lab', 'Corporate R&D', 'Independent research institute', 'International lab'],
  },
  {
    id: 'organisation',
    label: 'Host organisation',
    kind: 'text',
    required: true,
    placeholder: 'Parent institute or company',
  },
  {
    id: 'branch',
    label: 'Branch or site',
    kind: 'text',
    required: false,
  },
  {
    id: 'facility',
    label: 'Laboratory or programme',
    kind: 'text',
    required: true,
    placeholder: 'Lab or project name',
  },
];

const PROGRAMME_FIELDS = [
  {
    id: 'programme_kind',
    label: 'Programme type',
    kind: 'select',
    required: true,
    options: ['National mission', 'Multi-institution consortium', 'Sponsored research programme', 'Testbed or pilot'],
  },
  {
    id: 'programme',
    label: 'Programme name',
    kind: 'text',
    required: true,
    placeholder: 'Official programme title',
  },
  {
    id: 'lead_unit',
    label: 'Lead unit',
    kind: 'text',
    required: false,
    placeholder: 'Coordinating department or centre',
  },
  {
    id: 'branch',
    label: 'Participating branch',
    kind: 'text',
    required: false,
  },
];

const STARTUP_FIELDS = [
  {
    id: 'organisation',
    label: 'Company name',
    kind: 'text',
    required: true,
  },
  {
    id: 'branch',
    label: 'Office or site',
    kind: 'text',
    required: false,
  },
  {
    id: 'facility',
    label: 'Product or programme',
    kind: 'text',
    required: true,
    placeholder: 'What you operate on the platform',
  },
];

const INTERNATIONAL_FIELDS = [
  {
    id: 'org_kind',
    label: 'Organisation type',
    kind: 'select',
    required: true,
    options: ['Government agency', 'University', 'Company', 'Research consortium', 'Standards body'],
  },
  {
    id: 'organisation',
    label: 'Organisation name',
    kind: 'text',
    required: true,
  },
  {
    id: 'country',
    label: 'Country or region',
    kind: 'text',
    required: true,
    placeholder: 'e.g. United States, EU',
  },
  {
    id: 'branch',
    label: 'Site or branch',
    kind: 'text',
    required: false,
  },
  {
    id: 'facility',
    label: 'Facility or programme',
    kind: 'text',
    required: true,
  },
];

const NGO_FIELDS = [
  {
    id: 'organisation',
    label: 'Organisation name',
    kind: 'text',
    required: true,
  },
  {
    id: 'branch',
    label: 'Chapter or office',
    kind: 'text',
    required: false,
  },
  {
    id: 'facility',
    label: 'Programme or initiative',
    kind: 'text',
    required: true,
  },
];

const OTHER_FIELDS = [
  {
    id: 'custom_type',
    label: 'Organisation type',
    kind: 'text',
    required: true,
    placeholder: 'Describe the type in your own words',
  },
  {
    id: 'organisation',
    label: 'Organisation name',
    kind: 'text',
    required: true,
  },
  {
    id: 'branch',
    label: 'Branch or unit',
    kind: 'text',
    required: false,
  },
  {
    id: 'facility',
    label: 'Facility or programme',
    kind: 'text',
    required: true,
  },
];

export const ORG_FIELD_SCHEMA = {
  government: GOVERNMENT_FIELDS,
  university: UNIVERSITY_FIELDS,
  private: PRIVATE_FIELDS,
  research: RESEARCH_FIELDS,
  national_programme: PROGRAMME_FIELDS,
  startup: STARTUP_FIELDS,
  international: INTERNATIONAL_FIELDS,
  ngo: NGO_FIELDS,
  other: OTHER_FIELDS,
};

export function orgTilesForRegister() {
  return REGISTER_ORG_TILES.slice();
}

export function getFieldsForOrgType(typeId) {
  return ORG_FIELD_SCHEMA[typeId] || [];
}

function fieldVisible(field, values) {
  const rule = field.showWhen;
  if (!rule) return true;
  const current = (values[rule.field] || '').trim();
  return rule.in.includes(current);
}

export function visibleOrgFields(typeId, values) {
  return getFieldsForOrgType(typeId).filter((f) => fieldVisible(f, values));
}

export function filterMasterOptions(options, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.toLowerCase().includes(q));
}

export function buildOrgString(typeId, values) {
  const tile = REGISTER_ORG_TILES.find((t) => t.id === typeId);
  if (!tile) return '';
  const segments = visibleOrgFields(typeId, values)
    .map((f) => (values[f.id] || '').trim())
    .filter(Boolean);
  const deduped = segments.filter((s, i) => i === 0 || s.localeCompare(segments[i - 1], undefined, { sensitivity: 'accent' }) !== 0);
  if (!deduped.length) return '';
  return `${tile.label} · ${deduped.join(' · ')}`;
}

export function validateOrgDetail(typeId, values) {
  const errors = {};
  for (const field of getFieldsForOrgType(typeId)) {
    if (!fieldVisible(field, values)) continue;
    const val = (values[field.id] || '').trim();
    if (field.required && !val) {
      errors[field.id] = `Enter ${field.label.toLowerCase()}.`;
    }
  }
  const built = buildOrgString(typeId, values);
  if (!built) errors._org = 'Complete organisation details.';
  return errors;
}