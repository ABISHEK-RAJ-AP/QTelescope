/**
 * Self-registration organisation type master (A–Z). Icons are Lucide export names in RegisterPage.
 */
export const REGISTER_ORG_TYPES = [
  { id: 'academy', label: 'Academy', hint: 'National academies and learned societies', icon: 'GraduationCap', keywords: ['science', 'academy'] },
  { id: 'accelerator', label: 'Accelerator', hint: 'Startup accelerators and venture studios', icon: 'Rocket', keywords: ['venture', 'batch'] },
  { id: 'aerospace', label: 'Aerospace & defence', hint: 'Aviation, space, and defence contractors', icon: 'Building2', keywords: ['defence', 'defense', 'space'] },
  { id: 'association', label: 'Industry association', hint: 'Trade and professional member bodies', icon: 'Network', keywords: ['trade', 'member'] },
  { id: 'cloud', label: 'Cloud provider', hint: 'Hosted infrastructure and platform operators', icon: 'Globe2', keywords: ['hosting', 'saas'] },
  { id: 'consortium', label: 'Consortium', hint: 'Multi-party research or delivery alliances', icon: 'Network', keywords: ['alliance', 'partnership'] },
  { id: 'cooperative', label: 'Cooperative', hint: 'Member-owned enterprises', icon: 'HeartHandshake', keywords: ['co-op', 'mutual'] },
  { id: 'crown', label: 'Crown corporation', hint: 'Government-owned commercial entities', icon: 'Landmark', keywords: ['public', 'soe'] },
  { id: 'defence-agency', label: 'Defence agency', hint: 'National security and defence organisations', icon: 'Landmark', keywords: ['military', 'security'] },
  { id: 'department', label: 'Government department', hint: 'Ministries and executive agencies', icon: 'Landmark', keywords: ['ministry', 'government'] },
  { id: 'education-trust', label: 'Education trust', hint: 'School networks and education boards', icon: 'GraduationCap', keywords: ['school', 'trust'] },
  { id: 'engineering', label: 'Engineering firm', hint: 'Design, EPC, and systems integrators', icon: 'Building2', keywords: ['epc', 'integrator'] },
  { id: 'federated-lab', label: 'Federated laboratory', hint: 'Distributed lab networks', icon: 'FlaskConical', keywords: ['network', 'lab'] },
  { id: 'foundation', label: 'Foundation', hint: 'Grant-making and charitable foundations', icon: 'HeartHandshake', keywords: ['charity', 'grant'] },
  { id: 'government-lab', label: 'Government research lab', hint: 'Public-sector R&D facilities', icon: 'FlaskConical', keywords: ['national lab', 'public'] },
  { id: 'hardware', label: 'Hardware manufacturer', hint: 'Instruments, electronics, and OEM', icon: 'Building2', keywords: ['oem', 'device'] },
  { id: 'healthcare', label: 'Healthcare system', hint: 'Hospitals and clinical research groups', icon: 'HeartHandshake', keywords: ['hospital', 'clinical'] },
  { id: 'incubator', label: 'Incubator', hint: 'Early-stage venture support', icon: 'Rocket', keywords: ['startup', 'seed'] },
  { id: 'institute', label: 'Research institute', hint: 'Dedicated research institutes', icon: 'FlaskConical', keywords: ['institute', 'r&d'] },
  { id: 'intergov', label: 'Intergovernmental body', hint: 'Treaty-based international bodies', icon: 'Globe2', keywords: ['un', 'treaty'] },
  { id: 'international', label: 'International organisation', hint: 'Global agencies and programmes', icon: 'Globe2', keywords: ['global', 'agency'] },
  { id: 'investment', label: 'Investment partnership', hint: 'Funds and corporate venture arms', icon: 'Building2', keywords: ['vc', 'fund'] },
  { id: 'joint-centre', label: 'Joint research centre', hint: 'Shared facilities across partners', icon: 'FlaskConical', keywords: ['joint', 'centre', 'center'] },
  { id: 'limited-company', label: 'Limited company', hint: 'Private companies and subsidiaries', icon: 'Building2', keywords: ['ltd', 'company', 'corp'] },
  { id: 'listed', label: 'Listed company', hint: 'Publicly traded enterprises', icon: 'Building2', keywords: ['stock', 'public'] },
  { id: 'national-programme', label: 'National programme', hint: 'Flagship government or national missions', icon: 'Network', keywords: ['mission', 'programme', 'program'] },
  { id: 'ngo', label: 'NGO / non-profit', hint: 'Civil society and advocacy groups', icon: 'HeartHandshake', keywords: ['nonprofit', 'ngo'] },
  { id: 'partnership', label: 'Public–private partnership', hint: 'PPP and shared-governance entities', icon: 'Network', keywords: ['ppp', 'public private'] },
  { id: 'private', label: 'Private enterprise', hint: 'Corporates and industry teams', icon: 'Building2', keywords: ['industry', 'corporate'] },
  { id: 'semiconductor', label: 'Semiconductor firm', hint: 'Chip design and fabrication', icon: 'Building2', keywords: ['fab', 'chip'] },
  { id: 'software', label: 'Software vendor', hint: 'Product and platform software companies', icon: 'Building2', keywords: ['saas', 'software'] },
  { id: 'spinout', label: 'Spin-out / venture', hint: 'University or lab spin-offs', icon: 'Rocket', keywords: ['spinoff', 'startup'] },
  { id: 'standards', label: 'Standards body', hint: 'Specifications and conformance forums', icon: 'Network', keywords: ['iso', 'standard'] },
  { id: 'state-enterprise', label: 'State-owned enterprise', hint: 'Government commercial undertakings', icon: 'Landmark', keywords: ['soe', 'state'] },
  { id: 'startup', label: 'Startup', hint: 'Early-stage commercial teams', icon: 'Rocket', keywords: ['sme', 'venture'] },
  { id: 'technical-college', label: 'Technical college', hint: 'Polytechnics and vocational institutes', icon: 'GraduationCap', keywords: ['polytechnic', 'vocational'] },
  { id: 'think-tank', label: 'Think tank', hint: 'Policy and strategy research groups', icon: 'FlaskConical', keywords: ['policy', 'analysis'] },
  { id: 'university', label: 'University', hint: 'Degree-granting institutions', icon: 'GraduationCap', keywords: ['academic', 'campus'] },
  { id: 'university-hospital', label: 'University hospital', hint: 'Academic medical centres', icon: 'GraduationCap', keywords: ['medical', 'teaching hospital'] },
  { id: 'utility', label: 'Utility operator', hint: 'Energy, telecom, and grid operators', icon: 'Building2', keywords: ['energy', 'telecom'] },
  {
    id: 'other',
    label: 'Other',
    hint: 'Specify organisation type and name on the next step',
    icon: 'Layers',
    keywords: ['custom', 'other'],
    isOther: true,
  },
];

/** Sorted A–Z with “Other” last. */
export function orgTypesForRegister() {
  const standard = REGISTER_ORG_TYPES.filter((t) => !t.isOther)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
  const other = REGISTER_ORG_TYPES.find((t) => t.isOther);
  return other ? [...standard, other] : standard;
}

export function filterOrgTypes(types, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return types;
  return types.filter((t) => {
    if (t.isOther) return true;
    if (t.label.toLowerCase().includes(q)) return true;
    if (t.hint.toLowerCase().includes(q)) return true;
    return (t.keywords || []).some((k) => k.includes(q));
  });
}