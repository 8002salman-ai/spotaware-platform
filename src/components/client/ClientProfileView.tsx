import { bgCard, bd, tSec, tMut, bgIn } from './types';

interface ProfileState {
  name: string;
  email: string;
  company: string;
  phone: string;
  password: string;
}

interface Props {
  profile: ProfileState;
  setProfile: (p: ProfileState) => void;
  profileSaved: boolean;
  handleSaveProfile: () => void;
}

function Input({ label, value, onChange, type = 'text', ph = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; ph?: string }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} />
    </div>
  );
}

export default function ClientProfileView({ profile, setProfile, profileSaved, handleSaveProfile }: Props) {
  return (
    <div className="max-w-lg space-y-6">
      <h2 className="font-display text-xl font-bold text-white">My Profile</h2>
      <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: bd }}>
        <Input label="Full Name" value={profile.name} onChange={v => setProfile({ ...profile, name: v })} />
        <Input label="Email" value={profile.email} onChange={v => setProfile({ ...profile, email: v })} type="email" />
        <Input label="Company" value={profile.company} onChange={v => setProfile({ ...profile, company: v })} />
        <Input label="Phone" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} />
        <Input label="New Password (leave blank to keep)" value={profile.password} onChange={v => setProfile({ ...profile, password: v })} type="password" ph="••••••••" />
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs" style={{ color: profileSaved ? '#34d399' : tMut }}>{profileSaved ? '✓ Saved!' : ''}</p>
          <button onClick={handleSaveProfile} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Save Profile</button>
        </div>
      </div>
    </div>
  );
}
