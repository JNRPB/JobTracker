import { useEffect, useState } from "react";
import "./MyProfile.css";

const API_BASE = "";
const EMPTY_PROFILE = {
  displayName: "",
  username: "",
  role: "member",
  homeView: "standard",
  profileImageUrl: "",
  email: "",
  phone: "",
  jobTitle: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
};

function MyProfile({ currentUser, onCurrentUserChange, navigate }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/my-profile`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load your profile.");
        if (!cancelled) setProfile({ ...EMPTY_PROFILE, ...(data.profile || {}) });
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("Saving your details…");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/my-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      setProfile({ ...EMPTY_PROFILE, ...(data.profile || {}) });
      onCurrentUserChange?.(data.user);
      setMessage("Your profile is up to date.");
    } catch (nextError) {
      setMessage("");
      setError(nextError.message);
    } finally {
      setSaving(false);
    }
  }

  const initials = String(profile.displayName || currentUser?.displayName || "JNR")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="myProfilePage">
      <header className="myProfileHeader">
        <div>
          <p>Personal settings</p>
          <h1>My profile</h1>
          <span>Keep your own contact and work details current.</span>
        </div>
        <button type="submit" form="my-profile-form" disabled={loading || saving}>{saving ? "Saving…" : "Save profile"}</button>
      </header>

      <section className="myProfileHero">
        <span className="myProfileAvatar">
          {profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="" /> : initials}
        </span>
        <div>
          <span>{profile.jobTitle || (profile.role === "admin" ? "Administrator" : "JNR team")}</span>
          <h2>{profile.displayName || "Your JNR profile"}</h2>
          <p>Signed in as <strong>@{profile.username || currentUser?.username}</strong></p>
        </div>
        <span className="myProfileAccess">{profile.homeView === "site" ? "My Work account" : profile.role === "admin" ? "Full HQ access" : "HQ account"}</span>
      </section>

      {error && <p className="myProfileNotice error" role="alert">{error}</p>}
      {message && <p className="myProfileNotice" role="status">{message}</p>}

      <form id="my-profile-form" className="myProfileForm" onSubmit={saveProfile}>
        <section className="myProfileCard">
          <div className="myProfileCardHeading"><div><p>About you</p><h2>Personal details</h2></div><span>Visible to the JNR team</span></div>
          <div className="myProfileFields twoColumns">
            <label>Display name<input value={profile.displayName} onChange={(event) => update("displayName", event.target.value)} required /></label>
            <label>Job title / trade<input value={profile.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} placeholder="e.g. Plasterer" /></label>
            <label>Email<input type="email" value={profile.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" /></label>
            <label>Phone<input value={profile.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Mobile number" /></label>
            <label className="wide">Home address<textarea rows="2" value={profile.address} onChange={(event) => update("address", event.target.value)} placeholder="Optional" /></label>
            <label className="wide">About / useful notes<textarea rows="3" value={profile.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Skills, working preferences or anything useful for the team" /></label>
          </div>
        </section>

        <section className="myProfileCard">
          <div className="myProfileCardHeading"><div><p>If needed</p><h2>Emergency contact</h2></div><span>Only used by JNR</span></div>
          <div className="myProfileFields twoColumns">
            <label>Contact name<input value={profile.emergencyContactName} onChange={(event) => update("emergencyContactName", event.target.value)} placeholder="Name" /></label>
            <label>Contact number<input value={profile.emergencyContactPhone} onChange={(event) => update("emergencyContactPhone", event.target.value)} placeholder="Phone number" /></label>
          </div>
        </section>

        <aside className="myProfileLocked">
          <span>🔒</span>
          <div><strong>Login details are protected</strong><p>Your username, password, role and HQ permissions cannot be changed from this page.</p></div>
          {currentUser?.role === "admin" && <button type="button" onClick={() => navigate?.("Settings")}>Manage accounts in Settings</button>}
        </aside>
      </form>
    </main>
  );
}

export default MyProfile;
